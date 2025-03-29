import {
  apply,
  chain,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';

import { strings } from '@angular-devkit/core';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { MfSchematicSchema } from './schema';

import {
  patchAngularBuildPackageJson,
  privateEntrySrc,
} from '../../utils/patch-angular-build';

import {
  addPackageJsonDependency,
  getPackageJsonDependency,
  NodeDependencyType,
} from '@schematics/angular/utility/dependencies';

import * as path from 'path';

const SSR_VERSION = '^2.0.10';

type NormalizedOptions = {
  polyfills: string;
  projectName: string;
  projectRoot: string;
  projectSourceRoot: string;
  manifestPath: string;
  manifestRelPath: string;
  projectConfig: any;
  main: string;
  port: number;
};

type PackageJson = {
  dependencies: Record<string, string>;
};

export function updatePackageJson(tree: Tree): void {
  const packageJson = tree.readJson('package.json');

  const scriptCall =
    'node node_modules/@angular-architects/native-federation/src/patch-angular-build.js';

  if (!packageJson['scripts']) {
    packageJson['scripts'] = {};
  }

  let postInstall = (packageJson['scripts']?.['postinstall'] || '') as string;

  if (!postInstall) {
    return;
  }

  if (postInstall.includes(scriptCall)) {
    postInstall = postInstall.replace(scriptCall, '');
  }
  if (postInstall.endsWith(' && ')) {
    postInstall = postInstall.substring(0, postInstall.length - 4);
  }

  packageJson['scripts']['postinstall'] = postInstall;

  tree.overwrite('package.json', JSON.stringify(packageJson, null, 2));
}

export default function config(options: MfSchematicSchema): Rule {
  return async function (tree, context) {
    const workspaceFileName = getWorkspaceFileName(tree);
    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));
    const packageJson = JSON.parse(
      tree.read('package.json').toString('utf8')
    ) as PackageJson;

    const normalized = normalizeOptions(options, workspace, tree);

    const {
      polyfills,
      projectName,
      projectRoot,
      projectSourceRoot,
      manifestPath,
      manifestRelPath,
      main,
    } = normalized;

    updatePolyfills(tree, polyfills);

    const remoteMap = await generateRemoteMap(workspace, projectName);

    if (options.type === 'dynamic-host' && !tree.exists(manifestPath)) {
      tree.create(manifestPath, JSON.stringify(remoteMap, null, '\t'));
    }

    const federationConfigPath = path.join(projectRoot, 'federation.config.js');

    const exists = tree.exists(federationConfigPath);

    const cand1 = path.join(projectSourceRoot, 'app', 'app.component.ts');
    const cand2 = path.join(projectSourceRoot, 'app', 'app.ts');

    const appComponent = tree.exists(cand1)
      ? cand1
      : tree.exists(cand2)
      ? cand2
      : 'update-this.ts';

    const generateRule = !exists
      ? await generateFederationConfig(
          remoteMap,
          projectRoot,
          projectSourceRoot,
          appComponent,
          options
        )
      : noop;

    const ssr = isSsrProject(normalized);
    const server = ssr ? getSsrFilePath(normalized) : '';

    if (ssr) {
      console.log('SSR detected ...');
      console.log('Activating CORS ...');

      addPackageJsonDependency(tree, {
        name: 'cors',
        type: NodeDependencyType.Default,
        version: '^2.8.5',
        overwrite: false,
      });
    }

    updateWorkspaceConfig(tree, normalized, workspace, workspaceFileName, ssr);

    // updatePackageJson(tree);
    // patchAngularBuild(tree);

    addPackageJsonDependency(tree, {
      name: '@angular/animations',
      type: NodeDependencyType.Default,
      version:
        getPackageJsonDependency(tree, '@angular/core')?.version || 'latest',
      overwrite: false,
    });

    addPackageJsonDependency(tree, {
      name: '@angular-devkit/build-angular',
      type: NodeDependencyType.Dev,
      version:
        getPackageJsonDependency(tree, '@angular/build')?.version || 'latest',
      overwrite: false,
    });

    addPackageJsonDependency(tree, {
      name: 'es-module-shims',
      type: NodeDependencyType.Default,
      version: '^1.5.12',
      overwrite: false,
    });

    addPackageJsonDependency(tree, {
      name: '@softarc/native-federation-node',
      type: NodeDependencyType.Default,
      version: SSR_VERSION,
      overwrite: true,
    });

    context.addTask(new NodePackageInstallTask());

    return chain([
      generateRule,
      makeMainAsync(main, options, remoteMap, manifestRelPath),
      ssr
        ? makeServerAsync(server, options, remoteMap, manifestRelPath)
        : noop(),
    ]);
  };
}

function isSsrProject(normalized: NormalizedOptions) {
  return !!normalized.projectConfig?.architect?.build.options?.ssr;
}

function getSsrFilePath(normalized: NormalizedOptions): string {
  return normalized.projectConfig.architect.build.options.ssr.entry;
}

export function patchAngularBuild(tree: Tree) {
  const packagePath = 'node_modules/@angular/build/package.json';
  const privatePath = 'node_modules/@angular/build/private.js';

  if (!tree.exists(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(tree.read(packagePath).toString('utf8'));
  patchAngularBuildPackageJson(packageJson);
  tree.overwrite(packagePath, JSON.stringify(packageJson, null, 2));

  if (!tree.exists(privatePath)) {
    tree.create(privatePath, privateEntrySrc);
  } else {
    tree.overwrite(privatePath, privateEntrySrc);
  }
}

function updateWorkspaceConfig(
  tree: Tree,
  options: NormalizedOptions,
  workspace: any,
  workspaceFileName: string,
  ssr: boolean
) {
  const { projectConfig, projectName, port } = options;

  if (!projectConfig?.architect?.build || !projectConfig?.architect?.serve) {
    throw new Error(
      `The project doen't have a build or serve target in angular.json!`
    );
  }

  const originalBuild = projectConfig.architect.build;

  if (
    originalBuild.builder !== '@angular-devkit/build-angular:application' ||
    originalBuild.builder !== '@angular/build:application'
  ) {
    console.log(
      'Switching project to the application builder using esbuild ...'
    );
    originalBuild.builder = '@angular/build:application';
    delete originalBuild.configurations?.development?.buildOptimizer;
    delete originalBuild.configurations?.development?.vendorChunk;
  }

  if (originalBuild.options.main) {
    const main = originalBuild.options.main;
    delete originalBuild.options.main;
    originalBuild.options.browser = main;
  }

  delete originalBuild.options.commonChunk;

  projectConfig.architect.esbuild = originalBuild;

  projectConfig.architect.build = {
    builder: '@angular-architects/native-federation:build',
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

  if (ssr) {
    projectConfig.architect.build.options.ssr = true;
    projectConfig.architect.esbuild.options.prerender = false;
  }

  const serve = projectConfig.architect.serve;
  serve.options ??= {};
  serve.options.port = port;

  delete serve.options.commonChunk;

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
    builder: '@angular-architects/native-federation:build',
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
  workspace: any,
  tree: Tree
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

  const publicPath = path.join(projectRoot, 'public').replace(/\\/g, '/');

  let manifestPath = path
    .join(publicPath, 'federation.manifest.json')
    .replace(/\\/g, '/');

  let manifestRelPath = 'federation.manifest.json';

  const hasPublicFolder = tree
    .getDir(projectRoot)
    .subdirs.map((p) => String(p))
    .includes('public');

  if (!hasPublicFolder) {
    manifestPath = path
      .join(projectRoot, 'src/assets/federation.manifest.json')
      .replace(/\\/g, '/');

    manifestRelPath = 'assets/federation.manifest.json';
  }

  const main =
    projectConfig.architect.build.options.main ||
    projectConfig.architect.build.options.browser;

  if (!projectConfig.architect.build.options.polyfills) {
    projectConfig.architect.build.options.polyfills = [];
  }

  if (typeof projectConfig.architect.build.options.polyfills === 'string') {
    projectConfig.architect.build.options.polyfills = [
      projectConfig.architect.build.options.polyfills,
    ];
  }

  const polyfills = projectConfig.architect.build.options.polyfills;
  return {
    polyfills,
    projectName,
    projectRoot,
    projectSourceRoot,
    manifestPath,
    manifestRelPath,
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
  remoteMap: unknown,
  manifestRelPath: string
): Rule {
  return async function (tree) {
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
      newMainContent = `import { initFederation } from '@angular-architects/native-federation';

initFederation('${manifestRelPath}')
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    } else if (options.type === 'host') {
      const manifest = JSON.stringify(remoteMap, null, 2).replace(/"/g, "'");
      newMainContent = `import { initFederation } from '@angular-architects/native-federation';

initFederation(${manifest})
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    } else {
      newMainContent = `import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    }

    tree.overwrite(main, newMainContent);
  };
}

function makeServerAsync(
  server: string,
  options: MfSchematicSchema,
  remoteMap: unknown,
  manifestRelPath: string
): Rule {
  return async function (tree) {
    const mainPath = path.dirname(server);
    const bootstrapName = path.join(mainPath, 'bootstrap-server.ts');

    if (tree.exists(bootstrapName)) {
      console.info(`${bootstrapName} already exists.`);
      return;
    }

    const cors = `import { createRequire } from "module";
const require = createRequire(import.meta.url);
const cors = require("cors");
`;
    const mainContent = tree.read(server).toString('utf8');
    const updatedContent = (cors + mainContent)
      .replace(
        `const port = process.env['PORT'] || 4000`,
        `const port = process.env['PORT'] || ${options.port || 4000}`
      )
      .replace(
        `const app = express();`,
        `const app = express();\n\tapp.use(cors());\n  app.set('view engine', 'html');`
      )
      .replace(`if (isMainModule(import.meta.url)) {`, ``)
      .replace(/\}(?![\s\S]*\})/, '');

    tree.create(bootstrapName, updatedContent);

    let newMainContent = '';
    if (options.type === 'dynamic-host') {
      newMainContent = `import { initNodeFederation } from '@softarc/native-federation-node';

console.log('Starting SSR for Shell');

(async () => {

  await initNodeFederation({
    remotesOrManifestUrl: '../browser/federation.manifest.json',
    relBundlePath: '../browser/',
  });

  await import('./bootstrap-server');

})();
`;
    } else if (options.type === 'host') {
      const manifest = JSON.stringify(remoteMap, null, 2).replace(/"/g, "'");
      newMainContent = `import { initNodeFederation } from '@softarc/native-federation-node';

console.log('Starting SSR for Shell');

(async () => {

  await initNodeFederation({
    remotesOrManifestUrl: ${manifest},
    relBundlePath: '../browser/',
  });

  await import('./bootstrap-server');

})();
`;
    } else {
      newMainContent = `import { initNodeFederation } from '@softarc/native-federation-node';

(async () => {

  await initNodeFederation({
    relBundlePath: '../browser/'
  });

  await import('./bootstrap-server');

})();
`;
    }

    tree.overwrite(server, newMainContent);
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
  appComponentPath: string,
  options: MfSchematicSchema
) {
  const tmpl = url('./files');

  const applied = apply(tmpl, [
    template({
      projectRoot,
      projectSourceRoot,
      appComponentPath,
      remoteMap,
      ...options,
      tmpl: '',
    }),
    move(projectRoot),
  ]);

  return mergeWith(applied);
}
