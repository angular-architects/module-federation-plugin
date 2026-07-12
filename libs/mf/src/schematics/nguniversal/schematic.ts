import { NgUniversalSchema } from './schema';
import { Rule, chain } from '@angular-devkit/schematics';
import {
  generateSsrMappings,
  getWorkspaceFileName,
  adjustSSR,
} from '../init-webpack/schematic';
import * as path from 'path';

export default function nguniversal(options: NgUniversalSchema): Rule {
  return async function (tree) {
    const workspaceFileName = getWorkspaceFileName(tree);

    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));

    if (!options.project) {
      options.project = workspace.defaultProject;
    }

    if (!options.project) {
      throw new Error(
        `No default project found. Please specifiy a project name!`,
      );
    }

    const projectName = options.project;
    const projectConfig = workspace.projects[projectName];

    const projectSourceRoot: string = projectConfig.sourceRoot;

    if (!projectConfig?.architect?.server) {
      console.error(
        'No server target found. Did you add Angular Universal? Try ng add @nguniversal/common',
      );
    } else {
      // ngx-build-plus' ng-add used to wire the server target up to the shared
      // webpack config. @angular-builders/custom-webpack has no ng-add, so we
      // swap the server builder and point it at the same webpack.config.js.
      const projectRoot: string = projectConfig.root?.replace(/\\/g, '/');
      const configPath = path
        .join(projectRoot, 'webpack.config.js')
        .replace(/\\/g, '/');

      const server = projectConfig.architect.server;
      server.builder = '@angular-builders/custom-webpack:server';
      server.options = server.options ?? {};
      server.options.customWebpackConfig = { path: configPath };
    }

    const ssrMappings = generateSsrMappings(workspace, projectName);

    tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, '\t'));

    return chain([adjustSSR(projectSourceRoot, ssrMappings)]);
  };
}
