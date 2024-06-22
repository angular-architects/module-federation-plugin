import path = require('path');
import { noop } from 'rxjs';
import { getWorkspaceFileName } from '../mf/schematic';
import { Rule, Tree } from '@angular-devkit/schematics';
import { RemoveSchema } from './schema';

export default function remove(options: RemoveSchema): Rule {
  return async function (tree: Tree) {
    const workspaceFileName = getWorkspaceFileName(tree);
    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));
    const normalized = normalize(options, workspace);

    removeBootstrap(normalized, tree);

    updateBuildConfig(normalized);
    updateServeConfig(normalized);

    tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, 2));

    return noop();
  };
}

function updateBuildConfig(normalized: { projectConfig: any; projectName: string; }) {
  const build = normalized.projectConfig.architect.build;
  build.builder = '@angular-devkit/build-angular:browser';
  delete build.options.extraWebpackConfig;
  const buildProd = build.configurations.production;
  delete buildProd.extraWebpackConfig;
}

function updateServeConfig(normalized: { projectConfig: any; projectName: string; }) {
  const serve = normalized.projectConfig.architect.serve;
  serve.builder = '@angular-devkit/build-angular:dev-server';
  delete serve.options.extraWebpackConfig;

  const serveProd = serve.configurations.production;
  delete serveProd.extraWebpackConfig;

  const prodTarget = serveProd.browserTarget;
  if (prodTarget) {
    delete serveProd.browserTarget;
    serveProd.buildTarget = prodTarget;
  }

  const serveDev = serve.configurations.development;
  const devTarget = serveDev.browserTarget;

  if (devTarget) {
    delete serveDev.browserTarget;
    serveDev.buildTarget = devTarget;
  }

}

function normalize(options: RemoveSchema, workspace: any) {

  if (!options.project) {
    options.project = workspace.defaultProject;
  }

  if (!options.project && Object.keys(workspace.projects).length > 0) {
    options.project = Object.keys(workspace.projects)[0];
  }

  if (!options.project) {
    throw new Error(
      `No default project found. Please specifiy a project name!`
    );
  }

  const projectName = options.project;
  const projectConfig = workspace.projects[projectName];

  if (!projectConfig?.architect?.build?.options?.main) {
    throw new Error(
      `architect.build.options.main not found for project ` + projectName
    );
  }
  return { projectConfig, projectName };
}

function removeBootstrap(normalized, tree) {
  const currentMain = normalized.projectConfig.architect.build.options.main;

  const mainPath = path
    .join(path.dirname(currentMain), 'main.ts')
    .replace(/\\/g, '/');

  const bootstrapPath = path
    .join(path.dirname(currentMain), 'bootstrap.ts')
    .replace(/\\/g, '/');

  const content = tree.readText(bootstrapPath);
  tree.overwrite(mainPath, content);
  tree.delete(bootstrapPath);
}

