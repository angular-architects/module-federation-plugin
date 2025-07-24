import { Rule, Tree } from '@angular-devkit/schematics';

import { MfSchematicSchema } from './schema';

import * as path from 'path';

type NormalizedOptions = {
  polyfills: string;
  projectName: string;
  projectRoot: string;
  projectSourceRoot: string;
  manifestPath: string;
  projectConfig: any;
  main: string;
};

export default function remove(options: MfSchematicSchema): Rule {
  return async function (tree /*, context*/) {
    const workspaceFileName = getWorkspaceFileName(tree);
    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));

    const normalized = normalizeOptions(options, workspace);

    const { polyfills, projectRoot } = normalized;

    const bootstrapPath = path.join(projectRoot, 'src/bootstrap.ts');
    const mainPath = path.join(projectRoot, 'src/main.ts');

    makeMainSync(tree, bootstrapPath, mainPath);
    updatePolyfills(tree, polyfills);
    updateWorkspaceConfig(tree, normalized, workspace, workspaceFileName);
  };
}

function makeMainSync(tree, bootstrapPath: string, mainPath: string) {
  if (tree.exists(bootstrapPath) && tree.exists(mainPath)) {
    tree.delete(mainPath);
    tree.rename(bootstrapPath, mainPath);
  }
}

function updateWorkspaceConfig(
  tree: Tree,
  options: NormalizedOptions,
  workspace: any,
  workspaceFileName: string
) {
  const { projectConfig } = options;

  if (!projectConfig?.architect?.build || !projectConfig?.architect?.serve) {
    throw new Error(
      `The project doesn't have a build or serve target in angular.json!`
    );
  }

  if (projectConfig.architect.esbuild) {
    projectConfig.architect.build = projectConfig.architect.esbuild;
    delete projectConfig.architect.esbuild;
  }

  if (projectConfig.architect['serve-original']) {
    projectConfig.architect.serve = projectConfig.architect['serve-original'];
    delete projectConfig.architect['serve-original'];
  }

  if (projectConfig.architect.serve) {
    const conf = projectConfig.architect.serve.configurations;
    conf.production.buildTarget = conf.production.buildTarget.replace(
      ':esbuild:',
      ':build:'
    );
    conf.development.buildTarget = conf.development.buildTarget.replace(
      ':esbuild:',
      ':build:'
    );
  }

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

  const main = projectConfig.architect.build.options.main;

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
  if (polyfillsContent.includes('es-module-shims')) {
    polyfillsContent = polyfillsContent.replace(
      `import 'es-module-shims';`,
      ''
    );
    tree.overwrite(polyfills, polyfillsContent);
  }
}

function updatePolyfillsArray(tree, polyfills: any) {
  const polyfillsConfig = polyfills as string[];

  const index = polyfillsConfig.findIndex((p) => p === 'es-module-shims');
  if (index === -1) {
    return;
  }

  polyfillsConfig.splice(index, 1);
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
