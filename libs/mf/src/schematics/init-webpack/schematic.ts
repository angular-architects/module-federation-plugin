import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';

import { strings } from '@angular-devkit/core';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import * as json5 from 'json5';
import * as semver from 'semver';

// import { spawn } from 'cross-spawn';
import * as path from 'path';

import { createConfig } from '../../utils/create-config';
import { prodConfig } from './prod-config';
import { MfSchematicSchema } from './schema';

import {
  addPackageJsonDependency,
  getPackageJsonDependency,
  NodeDependencyType,
} from '@schematics/angular/utility/dependencies';

export function init(options: MfSchematicSchema): Rule {
  return config(options);
}

export function adjustSSR(sourceRoot: string, ssrMappings: string): Rule {
  return async function (tree) {
    const server = path.join(sourceRoot, 'server.ts');

    if (!tree.exists(server)) {
      return;
    }

    let content = tree.read(server).toString('utf-8');

    const imports = `import { CustomResourceLoader } from '@nguniversal/common/clover/server/src/custom-resource-loader';
import { createFetch } from '@angular-architects/module-federation/nguniversal';
`;

    content = imports + content;
    content = content.replace(
      'const ssrEngine = new Engine();',
      `
// Without mappings, remotes are loaded via HTTP
const mappings = ${ssrMappings};

// Monkey Patching Angular Universal for Module Federation
CustomResourceLoader.prototype.fetch = createFetch(mappings);

const ssrEngine = new Engine();
`
    );

    // Compensate for issue with version 12.0.0
    content = content.replace(
      'const HOST = `http://localhost:${PORT}`;',
      'const HOST = `localhost:${PORT}`;'
    );

    tree.overwrite(server, content);
  };
}

function makeMainAsync(main: string, options: MfSchematicSchema): Rule {
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
      newMainContent = `import { initFederation } from '@angular-architects/module-federation';

initFederation('mf.manifest.json')
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
`;
    } else {
      newMainContent =
        "import('./bootstrap')\n\t.catch(err => console.error(err));\n";
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

interface PackageJson {
  scripts?: { [key: string]: string };
}

function updatePackageJson(tree: Tree): void {
  const packageJson: PackageJson = JSON.parse(
    tree.read('package.json').toString('utf-8')
  );

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  if (!packageJson.scripts['run:all']) {
    packageJson.scripts['run:all'] =
      'node node_modules/@angular-architects/module-federation/src/server/mf-dev-server.js';
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
  return true;
}

function infereNxBuilderNames(tree: Tree): { dev: string; prod: string } {
  const dep = getPackageJsonDependency(tree, '@nx/angular');

  const useDevServer =
    dep &&
    dep.version &&
    semver.satisfies(semver.minVersion(dep.version), '>=17.2.0');

  const defaultResult = {
    dev: useDevServer
      ? '@nx/angular:dev-server'
      : '@nx/angular:webpack-dev-server',
    prod: '@nx/angular:webpack-browser',
  };

  return defaultResult;
}

async function generateWebpackConfig(
  remoteMap: Record<string, string>,
  projectRoot: string,
  projectSourceRoot: string,
  appComponent: string,
  options: MfSchematicSchema
) {
  const tmpl = url('./files');

  const applied = apply(tmpl, [
    template({
      projectRoot,
      projectSourceRoot,
      remoteMap,
      ...options,
      appComponent,
      tmpl: '',
    }),
    move(projectRoot),
  ]);

  return mergeWith(applied);
}

export default function config(options: MfSchematicSchema): Rule {
  return async function (tree, context) {
    const workspaceFileName = getWorkspaceFileName(tree);

    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));

    if (!options.project) {
      options.project = workspace.defaultProject;
    }

    const projectNames = Object.keys(workspace.projects);
    if (!options.project && projectNames.length > 0) {
      options.project = projectNames[0];
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

    const configPath = path
      .join(projectRoot, 'webpack.config.js')
      .replace(/\\/g, '/');
    const configProdPath = path
      .join(projectRoot, 'webpack.prod.config.js')
      .replace(/\\/g, '/');
    const manifestPath = path
      .join(projectRoot, 'public/mf.manifest.json')
      .replace(/\\/g, '/');

    const buildConfig = projectConfig?.architect?.build;
    const isApplicationBuilder =
      buildConfig?.builder === '@angular-devkit/build-angular:application' ||
      buildConfig?.builder === '@angular/build:application';

    if (isApplicationBuilder && !options.skipConfirmation) {
      console.warn(
        `\nWARNING: This package uses the traditional webpack-based Module Federation implementation and not the fast new esbuild-based ApplicationBuilder.`
      );
      console.warn(
        `\nFor new projects, consider Native Federation as an alternative: https://shorturl.at/0ZQ0j`
      );
      console.warn(
        `\nHowever, if you want to add a new host or remote to an existing Module Federation-based system, this package is what you are looking for.`
      );
      console.warn(`\nDo you want to proceeed: [y] Yes [n] No \n`);

      for (;;) {
        const key = await readKey();
        if (key === 'Y' || key === 'y') {
          break;
        }
        if (key === 'N' || key === 'n') {
          process.exit(0);
        }
      }
    }

    if (buildConfig?.options?.browser) {
      buildConfig.options.main = buildConfig.options.browser;
      delete buildConfig.options.browser;
      delete buildConfig.options.server;
      delete buildConfig.options.prerender;
    }

    if (buildConfig?.options?.assets) {
      updateAssets();
    }

    const port = parseInt(options.port) || 4200;
    const main = projectConfig.architect.build.options.main;

    const relWorkspaceRoot = path.relative(projectRoot, '');
    const tsConfigName = tree.exists('tsconfig.base.json')
      ? 'tsconfig.base.json'
      : 'tsconfig.json';

    const relTsConfigPath = path
      .join(relWorkspaceRoot, tsConfigName)
      .replace(/\\/g, '/');

    if (isNaN(port)) {
      throw new Error(`Port must be a number!`);
    }

    const remoteMap = await generateRemoteMap(workspace, projectName);

    const cand1 = path.join(projectSourceRoot, 'app', 'app.component.ts');
    const cand2 = path.join(projectSourceRoot, 'app', 'app.ts');

    const appComponent = tree.exists(cand1)
      ? cand1
      : tree.exists(cand2)
      ? cand2
      : 'update-this.ts';

    let generateRule = null;

    if (options.type === 'legacy') {
      const remotes = generateRemoteConfig(workspace, projectName);
      const webpackConfig = createConfig(
        projectName,
        remotes,
        relTsConfigPath,
        projectRoot
      );
      tree.create(configPath, webpackConfig);
    } else {
      generateRule = await generateWebpackConfig(
        remoteMap,
        projectRoot,
        projectSourceRoot,
        appComponent,
        options
      );
    }

    tree.create(configProdPath, prodConfig);

    if (options.type === 'dynamic-host') {
      tree.create(manifestPath, JSON.stringify(remoteMap, null, '\t'));
    }

    if (options.nxBuilders && !nxBuildersAvailable(tree)) {
      console.info(
        'To use Nx builders, make sure you have Nx version 12.9 or higher!'
      );
      options.nxBuilders = false;
    } else if (typeof options.nxBuilders === 'undefined') {
      options.nxBuilders = nxBuildersAvailable(tree); // tree.exists('nx.json');
    }

    const nxBuilderNames = infereNxBuilderNames(tree);

    if (options.nxBuilders) {
      console.log('Using Nx builders!');
    } else if (isApplicationBuilder) {
      console.log('Switching to webpack');
    }

    const webpackProperty = options.nxBuilders
      ? 'customWebpackConfig'
      : 'extraWebpackConfig';
    const buildBuilder = options.nxBuilders
      ? nxBuilderNames.prod
      : 'ngx-build-plus:browser';
    const serveBuilder = options.nxBuilders
      ? nxBuilderNames.dev
      : 'ngx-build-plus:dev-server';

    if (!projectConfig?.architect?.build || !projectConfig?.architect?.serve) {
      throw new Error(
        `The project doen't have a build or serve target in angular.json!`
      );
    }

    if (!projectConfig.architect.build.options) {
      projectConfig.architect.build.options = {};
    }

    if (!projectConfig.architect.serve.options) {
      projectConfig.architect.serve.options = {};
    }

    const indexPath = path.join(projectSourceRoot, 'index.html');

    projectConfig.architect.build.options.outputPath =
      projectConfig.architect.build.options.outputPath ?? `dist/${projectName}`;

    projectConfig.architect.build.options.index =
      projectConfig.architect.build.options.index ?? indexPath;

    projectConfig.architect.build.builder = buildBuilder;
    projectConfig.architect.build.options[webpackProperty] =
      getWebpackConfigValue(options.nxBuilders, configPath);
    projectConfig.architect.build.options.commonChunk = false;
    projectConfig.architect.build.configurations.production[webpackProperty] =
      getWebpackConfigValue(options.nxBuilders, configProdPath);

    projectConfig.architect.serve.builder = serveBuilder;
    projectConfig.architect.serve.options.port = port;
    projectConfig.architect.serve.options.publicHost = `http://localhost:${port}`;

    // Only needed for ngx-build-plus
    if (!options.nxBuilders) {
      projectConfig.architect.serve.options[webpackProperty] =
        getWebpackConfigValue(options.nxBuilders, configPath);
      projectConfig.architect.serve.configurations.production[webpackProperty] =
        getWebpackConfigValue(options.nxBuilders, configProdPath);
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
      projectConfig.architect['extract-i18n'].builder =
        'ngx-build-plus:extract-i18n';
      projectConfig.architect['extract-i18n'].options.extraWebpackConfig =
        configPath;
    }

    updateTsConfig(tree, tsConfigName);

    const localTsConfig = path.join(projectRoot, 'tsconfig.app.json');
    if (tree.exists(localTsConfig)) {
      updateTsConfig(tree, localTsConfig);
    }

    const ssrMappings = generateSsrMappings(workspace, projectName);

    tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, '\t'));

    updatePackageJson(tree);

    const dep = getPackageJsonDependency(tree, 'ngx-build-plus');

    let installDeps = false;
    if (!dep || !semver.satisfies(dep.version, '>=20.0.0')) {
      addPackageJsonDependency(tree, {
        name: 'ngx-build-plus',
        type: NodeDependencyType.Dev,
        version: '^20.0.0',
        overwrite: true,
      });

      installDeps = true;
    }

    if (!getPackageJsonDependency(tree, '@angular-devkit/build-angular')) {
      addPackageJsonDependency(tree, {
        name: '@angular-devkit/build-angular',
        type: NodeDependencyType.Dev,
        version:
          getPackageJsonDependency(tree, '@angular/cli')?.version || 'latest',
        overwrite: false,
      });

      installDeps = true;
    }

    if (installDeps) {
      context.addTask(new NodePackageInstallTask());
    }

    return chain([
      ...(generateRule ? [generateRule] : []),
      makeMainAsync(main, options),
      adjustSSR(projectSourceRoot, ssrMappings),
    ]);

    function updateAssets() {
      for (const asset of buildConfig.options.assets) {
        if (typeof asset === 'object' && typeof asset.output === 'undefined') {
          asset.output = '.';
        }
      }
    }
  };
}

async function readKey() {
  return await new Promise((r) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      r(key);
    });
  });
}

function updateTsConfig(tree, tsConfigName: string) {
  const tsConfig = json5.parse(tree.read(tsConfigName).toString('utf-8'));
  const target = tsConfig.compilerOptions.target as string;
  let targetVersion = 2022;

  if (
    target &&
    target.toLocaleLowerCase().startsWith('es') &&
    target.length > 2
  ) {
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

    if (
      p !== projectName &&
      projectType === 'application' &&
      project?.architect?.serve &&
      project?.architect?.build
    ) {
      const pPort = project.architect.serve.options?.port ?? 4200;

      remotes += `        //     "${strings.camelize(
        p
      )}": "http://localhost:${pPort}/remoteEntry.js",\n`;
    }
  }

  if (!remotes) {
    remotes =
      '        //     "mfe1": "http://localhost:3000/remoteEntry.js",\n';
  }
  return remotes;
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
      result[strings.camelize(p)] = `http://localhost:${pPort}/remoteEntry.js`;
    }
  }

  if (Object.keys(result).length === 0) {
    result['mfe1'] = `http://localhost:3000/remoteEntry.js`;
  }

  return result;
}

export function generateSsrMappings(
  workspace: any,
  projectName: string
): string {
  let remotes = '{\n';

  const projectOutPath =
    workspace.projects[projectName].architect.build.options.outputPath;

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
      const outPath = project.architect.build.options.outputPath;
      const relOutPath =
        path.relative(projectOutPath, outPath).replace(/\\/g, '/') + '/';

      remotes += `\t// 'http://localhost:${pPort}/': join(__dirname, '${relOutPath}')\n`;
    }
  }

  remotes += '}';

  return remotes;
}

function downgradeToWebpack(build: any) {
  if (!build.options) {
    return;
  }

  if (build.options.browser) {
    build.options.main = build.options.browser;
    delete build.options.browser;
  }

  if (!build.options.assets) {
    return;
  }

  for (const asset of build.options.assets) {
    if (typeof asset === 'object' && typeof asset.output === 'undefined') {
      asset.output = '.';
    }
  }
}
