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

    updateWorkspaceConfig(tree, normalized, workspace, workspaceFileName);
  };
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
      `The project doen't have a build or serve target in angular.json!`
    );
  }

  if (projectConfig.architect.esbuild) {
    projectConfig.architect.esbuild.builder = '@angular/build:application';

    projectConfig.architect.esbuild.options.browser =
      projectConfig.architect.esbuild.options.main;
    delete projectConfig.architect.esbuild.options.main;
  }

  if (projectConfig.architect['serve-original']) {
    const target = projectConfig.architect['serve-original'];
    if (target.configurations?.production) {
      target.configurations.production.buildTarget =
        target.configurations.production.buildTarget.replace(
          ':build:',
          ':esbuild:'
        );
    }
    if (target.configurations?.development) {
      target.configurations.development.buildTarget =
        target.configurations.development.buildTarget.replace(
          ':build:',
          ':esbuild:'
        );
    }
  }

  if (projectConfig.architect.serve) {
    const target = projectConfig.architect.serve;
    target.options.target = target.options.target.replace(
      ':esbuild:',
      ':serve-original:'
    );
    delete target.options.port;
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
    throw new Error(`Project ${projectName} not found in angular.json.`);
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
