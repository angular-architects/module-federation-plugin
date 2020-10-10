import {
  chain,
  Rule,
  externalSchematic,
} from '@angular-devkit/schematics';
import {
  updateWorkspace,
} from '@nrwl/workspace';

import { spawn } from 'cross-spawn';
import * as path from 'path';

import { createConfig } from '../../create-config';
import { prodConfig } from './prod-config';
import { MfSchematicSchema } from './schema';

export async function npmInstall(packageName: string) {
  await new Promise<boolean>((resolve) => {
    console.log('Installing packages...');
    spawn('npm', ['install', packageName, '-D'])
      .on('close', (code: number) => {
        if (code === 0) {
          console.log('Packages installed successfully ✅');
          resolve(true);
        } else {
          throw new Error(
            `Error installing '${packageName}'`
          );
        }
      });
  });
}

export async function yarnAdd(packageName: string) {
  await new Promise<boolean>((resolve) => {
    spawn('npm', ['install', packageName, '-D'])
      .on('close', (code: number) => {
        if (code === 0) {
          resolve(true);
        } else {
          throw new Error(
            `Error installing '${packageName}'`
          );
        }
      });
  });
}

export function add(options: MfSchematicSchema): Rule {
  return config(options);
}

export default function config (options: MfSchematicSchema): Rule {

  return async function (tree) {

    const workspace =
      JSON.parse(tree.read('angular.json').toString('utf8'));

    if (!options.project) {
      options.project = workspace.defaultProject;
    }

    if (!options.project) {
      throw new Error(`No default project found. Please specifiy a project name!`)
    }

    const projectName = options.project;
    const projectConfig = workspace.projects[projectName];

    if (!projectConfig) {
      throw new Error(`Project ${projectName} not found!`);
    }

    const projectRoot: string = projectConfig.root;

    const configPath = path.join(projectRoot, 'webpack.config.js').replace(/\\/g, '/');
    const configProdPath = path.join(projectRoot, 'webpack.prod.config.js').replace(/\\/g, '/');
    const port = parseInt(options.port);

    if (isNaN(port)) {
      throw new Error(`Port must be a number!`);
    }

    const webpackConfig = createConfig(projectName, projectRoot, port);

    tree.create(configPath, webpackConfig);
    tree.create(configProdPath, prodConfig);

    // const useYarn = (workspace.cli?.packageManager === 'yarn');

    // if (useYarn) {
    //   await yarnAdd('ngx-build-plus');
    // }
    // else {
    //   await npmInstall('ngx-build-plus');
    // }

    return chain([
      externalSchematic('ngx-build-plus', 'ng-add', { project: options.project }),
      updateWorkspace((workspace) => {
        const proj = workspace.projects.get(options.project);
        proj.targets.get('build').options.extraWebpackConfig = configPath;
        proj.targets.get('build').configurations.production.extraWebpackConfig = configProdPath;
        proj.targets.get('serve').options.extraWebpackConfig = configPath;
        proj.targets.get('serve').options.port = options.port;
        proj.targets.get('serve').configurations.production.extraWebpackConfig = configProdPath;
        proj.targets.get('test').options.extraWebpackConfig = configPath;
      })
    ]);

  }
}

