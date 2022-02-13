import {
  chain,
  Rule,
  Tree,
} from '@angular-devkit/schematics';

import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { strings } from '@angular-devkit/core';
import * as json5 from 'json5';
import * as semver from 'semver' 

// import { spawn } from 'cross-spawn';
import * as path from 'path';

import { createConfig } from '../../utils/create-config';
import { prodConfig } from './prod-config';
import { MfSchematicSchema } from './schema';

import { addPackageJsonDependency, NodeDependencyType } from '@schematics/angular/utility/dependencies';
import { hostname } from 'os';

// export async function npmInstall(packageName: string) {
//   await new Promise<boolean>((resolve) => {
//     console.log('Installing packages...');
//     spawn('npm', ['install', packageName, '-D'])
//       .on('close', (code: number) => {
//         if (code === 0) {
//           console.log('Packages installed successfully ✅');
//           resolve(true);
//         } else {
//           throw new Error(
//             `Error installing '${packageName}'`
//           );
//         }
//       });
//   });
// }

// export async function yarnAdd(packageName: string) {
//   await new Promise<boolean>((resolve) => {
//     spawn('npm', ['install', packageName, '-D'])
//       .on('close', (code: number) => {
//         if (code === 0) {
//           resolve(true);
//         } else {
//           throw new Error(
//             `Error installing '${packageName}'`
//           );
//         }
//       });
//   });
// }

export function add(options: MfSchematicSchema): Rule {
  return config(options);
}

export function adjustSSR(sourceRoot: string, ssrMappings: string): Rule {
  return async function (tree, context) {

    const server = path.join(sourceRoot, 'server.ts');

    if (!tree.exists(server)) {
      return;
    }

    let content = tree.read(server).toString('utf-8');

    const imports = `import { CustomResourceLoader } from '@nguniversal/common/clover/server/src/custom-resource-loader';
import { createFetch } from '@angular-architects/module-federation/nguniversal';
`;

    content = imports + content;
    content = content.replace('const ssrEngine = new Engine();', `
// Without mappings, remotes are loaded via HTTP
const mappings = ${ssrMappings};

// Monkey Patching Angular Universal for Module Federation
CustomResourceLoader.prototype.fetch = createFetch(mappings);

const ssrEngine = new Engine();
`);

    // Compensate for issue with version 12.0.0
    content = content.replace(
      'const HOST = `http://localhost:${PORT}`;',
      'const HOST = `localhost:${PORT}`;');

    tree.overwrite(server, content);

  }
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

export function getWorkspaceFileName(tree: Tree): string {
  if (tree.exists('angular.json')) {
    return 'angular.json';
  }
  if (tree.exists('workspace.json')) {
    return 'workspace.json';
  }
  throw new Error('angular.json or workspae.json expected! Did you call this in your project\'s root?');
}

interface PackageJson {
  scripts?: { [key:string]: string };
}

function updatePackageJson(tree: Tree): void {

  const packageJson: PackageJson = JSON.parse(tree.read('package.json').toString('utf-8'));

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  if (!packageJson.scripts['run:all']) {
    packageJson.scripts['run:all'] = 'node node_modules/@angular-architects/module-federation/src/server/mf-dev-server.js';
  }

  tree.overwrite('package.json', JSON.stringify(packageJson, null, 2));
}

function getWebpackConfigValue(nx: boolean, path: string) {
  if (!nx) {
    return path;
  }

  return { path };
}

function nxBuildersAvailable(tree: Tree): boolean {

  if (!tree.exists('nx.json')) return false;

  const packageJson = JSON.parse(tree.read('package.json').toString('utf-8'));

  const version = packageJson?.devDependencies?.['@nrwl/workspace'] 
    ?? packageJson?.dependencies?.['@nrwl/workspace'];

  if (!version) return false;

  const minVersion = semver.minVersion(version).raw;

  return semver.satisfies(minVersion, '>=12.9.0');

}

export default function config (options: MfSchematicSchema): Rule {

  return async function (tree, context) {

    const workspaceFileName = getWorkspaceFileName(tree);

    const workspace =
      JSON.parse(tree.read(workspaceFileName).toString('utf8'));

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
    const projectSourceRoot: string = projectConfig.sourceRoot;

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

    if (options.nxBuilders && !nxBuildersAvailable(tree)) {
      console.info('To use Nx builders, make sure you have Nx version 12.9 or higher!');
      options.nxBuilders = false;
    }
    else if (typeof options.nxBuilders === 'undefined') {
      options.nxBuilders = nxBuildersAvailable(tree); // tree.exists('nx.json');
    }

    if (options.nxBuilders) {
      console.log('Using Nx builders!');
    }

    const webpackProperty = options.nxBuilders ? 'customWebpackConfig' : 'extraWebpackConfig';
    const buildBuilder = options.nxBuilders ? '@nrwl/angular:webpack-browser' : 'ngx-build-plus:browser';
    const serveBuilder = options.nxBuilders ? '@nrwl/angular:webpack-server' : 'ngx-build-plus:dev-server';

    if (!projectConfig?.architect?.build ||
      !projectConfig?.architect?.serve) {
        throw new Error(`The project doen't have a build or serve target in angular.json!`);
    }

    if (!projectConfig.architect.build.options) {
      projectConfig.architect.build.options = {};
    }

    if (!projectConfig.architect.serve.options) {
      projectConfig.architect.serve.options = {};
    }

    projectConfig.architect.build.builder = buildBuilder;
    projectConfig.architect.build.options[webpackProperty] = getWebpackConfigValue(options.nxBuilders, configPath);
    projectConfig.architect.build.options.commonChunk = false;
    projectConfig.architect.build.configurations.production[webpackProperty] = getWebpackConfigValue(options.nxBuilders, configProdPath);
    
    projectConfig.architect.serve.builder = serveBuilder;
    projectConfig.architect.serve.options.port = port;
    projectConfig.architect.serve.options.publicHost = `http://localhost:${port}`;

    // Only needed for ngx-build-plus
    if (!options.nxBuilders) {
      projectConfig.architect.serve.options[webpackProperty] = getWebpackConfigValue(options.nxBuilders, configPath);
      projectConfig.architect.serve.configurations.production[webpackProperty] = getWebpackConfigValue(options.nxBuilders, configProdPath);
    }

    // We don't change the config for testing anymore to prevent
    // issues with eager bundles and webpack
    // Consequence: 
    //    Remotes: No issue
    //    Hosts: Should be tested using an E2E test
    // if (projectConfig?.architect?.test?.options) {
    //   projectConfig.architect.test.options.extraWebpackConfig = configPath;
    // }
    
    if (projectConfig?.architect?.['extract-i18n']?.options) {
      projectConfig.architect['extract-i18n'].builder = 'ngx-build-plus:extract-i18n';
      projectConfig.architect['extract-i18n'].options.extraWebpackConfig = configPath;
    }


    updateTsConfig(tree, tsConfigName);

    const localTsConfig = path.join(projectRoot, 'tsconfig.app.json');
    console.log('localTsConfig', localTsConfig);
    if (tree.exists(localTsConfig)) {
      console.log('exists');

      updateTsConfig(tree, localTsConfig);
    }

    const ssrMappings = generateSsrMappings(workspace, projectName);

    tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, '\t'));

    updatePackageJson(tree);

    // addPackageJsonDependency(tree, { 
    //   name: 'ngx-build-plus', 
    //   type: NodeDependencyType.Dev,
    //   version: '^13.0.1',
    //   overwrite: true 
    // });

    // context.addTask(new NodePackageInstallTask());

    return chain([
      makeMainAsync(main),
      adjustSSR(projectSourceRoot, ssrMappings),
      // externalSchematic('ngx-build-plus', 'ng-add', { project: options.project }),
    ]);

  }
}

function updateTsConfig(tree, tsConfigName: string) {
  const tsConfig = json5.parse(tree.read(tsConfigName).toString('utf-8'));
  const target = tsConfig.compilerOptions.target as string;
  let targetVersion = 0;

  if (target
    && target.toLocaleLowerCase().startsWith("es")
    && target.length > 2) {
    targetVersion = parseInt(target.substring(2));
  }

  if (targetVersion < 2020) {
    tsConfig.compilerOptions.target = 'es2020';
  }

  tree.overwrite(tsConfigName, JSON.stringify(tsConfig, null, 2));
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
      const pPort = project.architect.serve.options?.port ?? 4200;
      
      remotes += `        //     "${strings.camelize(p)}": "http://localhost:${pPort}/remoteEntry.js",\n`;
    }
  }

  if (!remotes) {
    remotes = '        //     "mfe1": "http://localhost:3000/remoteEntry.js",\n';
  }
  return remotes;
}

export function generateSsrMappings(workspace: any, projectName: string): string {
  let remotes = '{\n';

  const projectOutPath = workspace.projects[projectName].architect.build.options.outputPath;

  for (const p in workspace.projects) {
    const project = workspace.projects[p];
    const projectType = project.projectType ?? 'application';

    if (p !== projectName 
        && projectType === 'application'
        && project?.architect?.serve
        && project?.architect?.build) {
      
          const pPort = project.architect.serve.options?.port ?? 4200;
          const outPath = project.architect.build.options.outputPath;
          const relOutPath = path.relative(projectOutPath, outPath).replace(/\\/g, '/') + '/';

      remotes += `\t// 'http://localhost:${pPort}/': join(__dirname, '${relOutPath}')\n`;
    }
  }

  remotes += '}';

  return remotes;
}

