import {
  chain,
  Rule,
  externalSchematic,
} from '@angular-devkit/schematics';

import { spawn } from 'cross-spawn';
import * as path from 'path';

import { createConfig } from '../../utils/create-config';
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


function makeMainAsync(main: string): Rule {
  return async function (tree, context) {

    const mainPath = path.dirname(main);
    const bootstrapName = path.join(mainPath, 'bootstrap.ts');

    if (tree.exists(bootstrapName)) {
      console.info(`${bootstrapName} already exists.`);
      return;
    }

    const mainContent = tree.read(main);
    tree.create(bootstrapName, mainContent);
    tree.overwrite(main, "import('./bootstrap')\n\t.catch(err => console.error(err));\n");

  }
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
    const main = projectConfig.architect.build.options.main;

    const relWorkspaceRoot = path.relative(projectRoot, '');
    const tsConfigName = tree.exists('tsconfig.base.json') ?
      'tsconfig.base.json' : 'tsconfig.json';

    const relTsConfigPath = path
      .join(relWorkspaceRoot, tsConfigName)
      .replace(/\\/g, '/');

    if (isNaN(port)) {
      throw new Error(`Port must be a number!`);
    }

    const remotes = generateRemoteConfig(workspace, projectName);
    const webpackConfig = createConfig(projectName, remotes, relTsConfigPath, projectRoot, port);

    tree.create(configPath, webpackConfig);
    tree.create(configProdPath, prodConfig);

    if (!projectConfig?.architect?.build ||
      !projectConfig?.architect?.serve) {
        throw new Error(`The project doen't have a build or serve target in angular.json!`);
    }

    projectConfig.architect.build.options = projectConfig.architect.build.options || {}
    projectConfig.architect.build.options.extraWebpackConfig = configPath;
    projectConfig.architect.build.configurations.production.extraWebpackConfig = configProdPath;
    projectConfig.architect.serve.options = projectConfig.architect.serve.options || {}
    projectConfig.architect.serve.options.extraWebpackConfig = configPath;
    projectConfig.architect.serve.options.port = port;
    projectConfig.architect.serve.configurations.production.extraWebpackConfig = configProdPath;

    if (projectConfig?.architect?.test?.options) {
      projectConfig.architect.test.options.extraWebpackConfig = configPath;
    }

    tree.overwrite('angular.json', JSON.stringify(workspace, null, '\t'));

    return chain([
      makeMainAsync(main),
      externalSchematic('ngx-build-plus', 'ng-add', { project: options.project }),
      // updateWorkspace((workspace) => {
      //   const proj = workspace.projects.get(options.project);
      //   proj.targets.get('build').options.extraWebpackConfig = configPath;
      //   proj.targets.get('build').configurations.production.extraWebpackConfig = configProdPath;
      //   proj.targets.get('serve').options.extraWebpackConfig = configPath;
      //   proj.targets.get('serve').options.port = port;
      //   proj.targets.get('serve').configurations.production.extraWebpackConfig = configProdPath;
      //   proj.targets.get('test').options.extraWebpackConfig = configPath;
      // })
    ]);

  }
}

function generateRemoteConfig(workspace: any, projectName: string) {
  let remotes = '';
  for (const p in workspace.projects) {
    const project = workspace.projects[p];
    const projectType = project.projectType ?? 'application';

    if (p !== projectName
        && projectType === 'application'
        && project?.architect?.serve
        && project?.architect?.build) {
      const pPort = project.architect.serve.options.port ?? 4200;
      remotes += `        //     "${p}": "${p}@http://localhost:${pPort}/remoteEntry.js",\n`;
    }
  }

  if (!remotes) {
    remotes = '        //     "mfe1": "mfe1@http://localhost:3000/remoteEntry.js",\n';
  }
  return remotes;
}

