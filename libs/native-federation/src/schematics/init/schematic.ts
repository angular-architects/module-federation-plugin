import {
  chain,
  Rule,
  Tree,
  url,
  apply,
  mergeWith,
  template,
  move,
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
}

export default function config(options: MfSchematicSchema): Rule {
  return async function (tree, context) {

    const workspaceFileName = getWorkspaceFileName(tree);
    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));

    const { 
      polyfills, 
      projectName, 
      projectRoot, 
      projectSourceRoot, 
      manifestPath, 
      projectConfig, 
      main 
    } = normalizeOptions(options, workspace);
    
    updatePolyfills(tree, polyfills);

    const remoteMap = await generateRemoteMap(workspace, projectName);

    if (options.type === 'dynamic-host') {
      tree.create(manifestPath, JSON.stringify(remoteMap, null, '\t'));
    }

    const generateRule = await generateFederationConfig(
      remoteMap,
      projectRoot,
      projectSourceRoot,
      options
    );

    updateWorkspaceConfig(
      projectConfig, 
      tree, 
      workspaceFileName, 
      workspace
    );

    addPackageJsonDependency(tree, {
      name: 'es-module-shims',
      type: NodeDependencyType.Default,
      version: '^1.5.12',
      overwrite: false,
    });

    context.addTask(new NodePackageInstallTask());

    return chain([
      generateRule,
      makeMainAsync(main, options, remoteMap),
    ]);
  };
}

function updateWorkspaceConfig(projectConfig: any, tree, workspaceFileName: string, workspace: any) {
  if (!projectConfig?.architect?.build || !projectConfig?.architect?.serve) {
    throw new Error(
      `The project doen't have a build or serve target in angular.json!`
    );
  }

  // TODO: When adding a builder for serve, we 
  //  should set the port
  // const port = parseInt(options.port);

  // if (isNaN(port)) {
  //   throw new Error(`Port must be a number!`);
  // }


  if (!projectConfig.architect.build.options) {
    projectConfig.architect.build.options = {};
  }

  if (!projectConfig.architect.serve.options) {
    projectConfig.architect.serve.options = {};
  }

  projectConfig.architect.build.builder = '@angular-architects/native-federation:build';

  // projectConfig.architect.serve.builder = serveBuilder;
  // TODO: Register further builders when ready
  tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, '\t'));
}

function normalizeOptions(options: MfSchematicSchema, workspace: any): NormalizedOptions {
  if (!options.project) {
    options.project = workspace.defaultProject;
  }

  if (!options.project) {
    throw new Error(
      `No default project found. Please specifiy a project name!`
    );
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
  const polyfills = projectConfig.architect.build.options.polyfills;
  return { polyfills, projectName, projectRoot, projectSourceRoot, manifestPath, projectConfig, main };
}

function updatePolyfills(tree, polyfills: any) {
  let polyfillsContent = tree.readText(polyfills);
  if (!polyfillsContent.includes('es-module-shims')) {
    polyfillsContent += `\nimport 'es-module-shims';\n`;
    tree.overwrite(polyfills, polyfillsContent);
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
      const pPort = project.architect.serve.options?.port ?? 4200;
      result[strings.camelize(p)] = `http://localhost:${pPort}/remoteEntry.json`;
    }
  }

  if (Object.keys(result).length === 0) {
    result['mfe1'] = `http://localhost:3000/remoteEntry.json`;
  }

  return result;
}

function makeMainAsync(main: string, options: MfSchematicSchema, remoteMap: unknown): Rule {
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
      newMainContent = `import { initFederation } from '@angular-architects/native-federation';

initFederation("/assets/federation.manifest.json")
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    } else {
      const manifest = JSON.stringify(remoteMap, null, 2).replace(/"/g, '\'');
      newMainContent = `import { initFederation } from '@angular-architects/native-federation';

initFederation(${manifest})
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
    }),
    move(projectRoot),
  ]);

  return mergeWith(applied);
}
