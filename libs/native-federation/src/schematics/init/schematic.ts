import {
  chain,
  Rule,
  Tree,
  url,
  apply,
  mergeWith,
  template,
  move,
  noop,
} from '@angular-devkit/schematics';

import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { strings } from '@angular-devkit/core';
import { MfSchematicSchema } from './schema';

import {
  addPackageJsonDependency,
  NodeDependencyType,
} from '@schematics/angular/utility/dependencies';

import * as path from 'path';

type NormalizedOptions = {
  polyfills: string;
  projectName: string;
  projectRoot: string;
  projectSourceRoot: string;
  manifestPath: string;
  projectConfig: any;
  main: string;
  port: number;
};

export default function config(options: MfSchematicSchema): Rule {
  return async function (tree, context) {
    const workspaceFileName = getWorkspaceFileName(tree);
    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));

    const normalized = normalizeOptions(options, workspace);

    const {
      polyfills,
      projectName,
      projectRoot,
      projectSourceRoot,
      manifestPath,
      main,
    } = normalized;

    updatePolyfills(tree, polyfills);

    const remoteMap = await generateRemoteMap(workspace, projectName);

    if (options.type === 'dynamic-host' && !tree.exists(manifestPath)) {
      tree.create(manifestPath, JSON.stringify(remoteMap, null, '\t'));
    }

    const federationConfigPath = path.join(projectRoot, 'federation.config.js');

    const exists = tree.exists(federationConfigPath);

    const generateRule = !exists
      ? await generateFederationConfig(
          remoteMap,
          projectRoot,
          projectSourceRoot,
          options
        )
      : noop;

    updateWorkspaceConfig(tree, normalized, workspace, workspaceFileName);

    addPackageJsonDependency(tree, {
      name: 'es-module-shims',
      type: NodeDependencyType.Default,
      version: '^1.5.12',
      overwrite: false,
    });
    addPackageJsonDependency(tree, {
      name: '@softarc/native-federation-runtime',
      type: NodeDependencyType.Default,
      version: '2.0.8',
      overwrite: false,
    });

    context.addTask(new NodePackageInstallTask());

    return chain([generateRule, makeMainAsync(main, options, remoteMap)]);
  };
}

function updateWorkspaceConfig(
  tree: Tree,
  options: NormalizedOptions,
  workspace: any,
  workspaceFileName: string
) {
  const { projectConfig, projectName, port } = options;

  if (!projectConfig?.architect?.build || !projectConfig?.architect?.serve) {
    throw new Error(
      `The project doen't have a build or serve target in angular.json!`
    );
  }

  const originalBuild = projectConfig.architect.build;

  if (originalBuild.builder !== '@angular-devkit/build-angular:application') {
    console.log(
      'Switching project to the application builder using esbuild ...'
    );
    originalBuild.builder = '@angular-devkit/build-angular:application';
    delete originalBuild.configurations?.development?.buildOptimizer;
    delete originalBuild.configurations?.development?.vendorChunk;
  }

  // if (originalBuild.options.browser) {
  //   const browser = originalBuild.options.browser;
  //   delete originalBuild.options.browser;
  //   originalBuild.options.main = browser;
  // }

  if (originalBuild.options.main) {
    const main = originalBuild.options.main;
    delete originalBuild.options.main;
    originalBuild.options.browser = main;
  }

  projectConfig.architect.esbuild = originalBuild;

  projectConfig.architect.build = {
    builder: '@dg/native-federation:build',
    options: {},
    configurations: {
      production: {
        target: `${projectName}:esbuild:production`,
      },
      development: {
        target: `${projectName}:esbuild:development`,
        dev: true,
      },
    },
    defaultConfiguration: 'production',
  };

  const serve = projectConfig.architect.serve;
  serve.options ??= {};
  serve.options.port = port;

  const serveProd = projectConfig.architect.serve.configurations?.production;
  if (serveProd) {
    serveProd.buildTarget = `${projectName}:esbuild:production`;
    delete serveProd.browserTarget;
  }

  const serveDev = projectConfig.architect.serve.configurations?.development;
  if (serveDev) {
    serveDev.buildTarget = `${projectName}:esbuild:development`;
    delete serveDev.browserTarget;
  }

  projectConfig.architect['serve-original'] = projectConfig.architect.serve;

  projectConfig.architect.serve = {
    builder: '@dg/native-federation:build',
    options: {
      target: `${projectName}:serve-original:development`,
      rebuildDelay: 0,
      dev: true,
      port: 0,
    },
  };

  const serveSsr = projectConfig.architect['serve-ssr'];
  if (serveSsr && !serveSsr.options) {
    serveSsr.options = {};
  }

  if (serveSsr) {
    serveSsr.options.port = port;
  }

  // projectConfig.architect.serve.builder = serveBuilder;
  // TODO: Register further builders when ready
  tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, '\t'));
}

function normalizeOptions(
  options: MfSchematicSchema,
  workspace: any
): NormalizedOptions {
  if (!options.project) {
    options.project = workspace.defaultProject;
  }

  const projects = Object.keys(workspace.projects);

  if (!options.project && projects.length === 0) {
    throw new Error(
      `No default project found. Please specifiy a project name!`
    );
  }

  if (!options.project) {
    console.log(
      'Using first configured project as default project: ' + projects[0]
    );
    options.project = projects[0];
  }

  const projectName = options.project;
  const projectConfig = workspace.projects[projectName];

  if (!projectConfig) {
    throw new Error(`Project ${projectName} not found!`);
  }

  const projectRoot: string = projectConfig.root?.replace(/\\/g, '/');
  const projectSourceRoot: string = projectConfig.sourceRoot?.replace(
    /\\/g,
    '/'
  );

  const manifestPath = path
    .join(projectRoot, 'src/assets/federation.manifest.json')
    .replace(/\\/g, '/');

  const main =
    projectConfig.architect.build.options.main ||
    projectConfig.architect.build.options.browser;

  if (!projectConfig.architect.build.options.polyfills) {
    projectConfig.architect.build.options.polyfills = [];
  }

  const polyfills = projectConfig.architect.build.options.polyfills;
  return {
    polyfills,
    projectName,
    projectRoot,
    projectSourceRoot,
    manifestPath,
    projectConfig,
    main,
    port: +(options.port || 4200),
  };
}

function updatePolyfills(tree, polyfills: any) {
  if (typeof polyfills === 'string') {
    updatePolyfillsFile(tree, polyfills);
  } else {
    updatePolyfillsArray(tree, polyfills);
  }
}

function updatePolyfillsFile(tree, polyfills: any) {
  let polyfillsContent = tree.readText(polyfills);
  if (!polyfillsContent.includes('es-module-shims')) {
    polyfillsContent += `\nimport 'es-module-shims';\n`;
    tree.overwrite(polyfills, polyfillsContent);
  }
}

function updatePolyfillsArray(tree, polyfills: any) {
  const polyfillsConfig = polyfills as string[];

  if (!polyfillsConfig.includes('es-module-shims')) {
    polyfillsConfig.push('es-module-shims');
  }
}

function generateRemoteMap(workspace: any, projectName: string) {
  const result = {};

  for (const p in workspace.projects) {
    const project = workspace.projects[p];
    const projectType = project.projectType ?? 'application';

    if (
      p !== projectName &&
      projectType === 'application' &&
      project?.architect?.serve &&
      project?.architect?.build
    ) {
      const pPort =
        project.architect['serve-original']?.options?.port ??
        project.architect.serve?.options?.port ??
        4200;
      result[
        strings.camelize(p)
      ] = `http://localhost:${pPort}/remoteEntry.json`;
    }
  }

  if (Object.keys(result).length === 0) {
    result['mfe1'] = `http://localhost:3000/remoteEntry.json`;
  }

  return result;
}

function makeMainAsync(
  main: string,
  options: MfSchematicSchema,
  remoteMap: unknown
): Rule {
  return async function (tree, context) {
    const mainPath = path.dirname(main);
    const bootstrapName = path.join(mainPath, 'bootstrap.ts');

    if (tree.exists(bootstrapName)) {
      console.info(`${bootstrapName} already exists.`);
      return;
    }

    const mainContent = tree.read(main);
    tree.create(bootstrapName, mainContent);

    let newMainContent = '';
    if (options.type === 'dynamic-host') {
      newMainContent = `import { initFederation } from '@softarc/native-federation-runtime';

initFederation('/assets/federation.manifest.json')
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    } else if (options.type === 'host') {
      const manifest = JSON.stringify(remoteMap, null, 2).replace(/"/g, "'");
      newMainContent = `import { initFederation } from '@softarc/native-federation-runtime';

initFederation(${manifest})
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    } else {
      newMainContent = `import { initFederation } from '@softarc/native-federation-runtime';

initFederation()
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    }

    tree.overwrite(main, newMainContent);
  };
}

export function getWorkspaceFileName(tree: Tree): string {
  if (tree.exists('angular.json')) {
    return 'angular.json';
  }
  if (tree.exists('workspace.json')) {
    return 'workspace.json';
  }
  throw new Error(
    "angular.json or workspace.json expected! Did you call this in your project's root?"
  );
}

async function generateFederationConfig(
  remoteMap: Record<string, string>,
  projectRoot: string,
  projectSourceRoot: string,
  options: MfSchematicSchema
) {
  const tmpl = url('./files');

  const applied = apply(tmpl, [
    template({
      projectRoot,
      projectSourceRoot,
      remoteMap,
      ...options,
      tmpl: '',
    }),
    move(projectRoot),
  ]);

  return mergeWith(applied);
}
