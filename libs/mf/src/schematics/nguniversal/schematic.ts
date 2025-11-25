import { NgUniversalSchema } from './schema';
import { Rule, chain, externalSchematic } from '@angular-devkit/schematics';
import {
  generateSsrMappings,
  getWorkspaceFileName,
  adjustSSR,
} from '../init-webpack/schematic';

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
    }

    const ssrMappings = generateSsrMappings(workspace, projectName);

    tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, '\t'));

    return chain([
      adjustSSR(projectSourceRoot, ssrMappings),
      externalSchematic('ngx-build-plus', 'ng-add', {
        project: options.project,
      }),
    ]);
  };
}
