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

import {
  NodePackageInstallTask,
  RunSchematicTask,
} from '@angular-devkit/schematics/tasks';

import { strings } from '@angular-devkit/core';
import * as json5 from 'json5';
import * as path from 'path';

import { MfSchematicSchema } from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkspaceConfig = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectConfig = any;

type NormalizedOptions = {
  workspace: WorkspaceConfig;
  projectConfig: ProjectConfig;
  projectName: string;
  projectRoot: string;
  projectSourceRoot: string;
  manifestPath: string;
  tsConfigName: string;
  workspaceFileName: string;
  main: string;
};

type PackageJson = {
  scripts?: { [key: string]: string };
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
};

const RSPACK_DEPS = {
  '@module-federation/enhanced': '0.8.7',
};

const RSPACK_DEV_DEPS = {
  '@ng-rsbuild/plugin-angular': '19.0.0-alpha.14',
};

export function init(options: MfSchematicSchema): Rule {
  return async function (tree, context) {
    const {
      workspace,
      projectName,
      projectRoot,
      projectSourceRoot,
      manifestPath,
      projectConfig,
      tsConfigName,
      workspaceFileName,
      main,
    } = normalizeOptions(tree, options);

    const remoteMap = await generateRemoteMap(workspace, projectName);

    const generateRule = await generateRsBuildConfig(
      remoteMap,
      projectRoot,
      projectSourceRoot,
      options
    );

    if (options.type === 'dynamic-host') {
      generteManifest(tree, manifestPath, remoteMap);
    }

    updateProjectConfig(projectConfig);

    updateTsConfig(tree, tsConfigName);

    updateLocalTsConfig(projectRoot, tree);

    writeProjectConfig(tree, workspaceFileName, workspace);

    updatePackageJson(
      tree,
      projectName,
      projectRoot,
      RSPACK_DEPS,
      RSPACK_DEV_DEPS
    );

    context.addTask(new RunSchematicTask('patch', {}), [
      context.addTask(new NodePackageInstallTask()),
    ]);

    return chain([
      ...(generateRule ? [generateRule] : []),
      makeMainAsync(main, options),
    ]);
  };
}

function normalizeOptions(tree, options: MfSchematicSchema): NormalizedOptions {
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

  const manifestPath = path
    .join(projectRoot, 'public/mf.manifest.json')
    .replace(/\\/g, '/');

  const tsConfigName = tree.exists('tsconfig.base.json')
    ? 'tsconfig.base.json'
    : 'tsconfig.json';

  const main =
    projectConfig.architect.build.options.main ??
    projectConfig.architect.build.options.browser;

  const port = parseInt(options.port) ?? 4200;
  options.port = String(port);
  return {
    workspace,
    projectName,
    projectRoot,
    projectSourceRoot,
    manifestPath,
    projectConfig,
    tsConfigName,
    workspaceFileName,
    main,
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
      newMainContent = `import { initFederation } from '@angular-architects/module-federation/runtime';

initFederation('mf.manifest.json');

//
// [HINT] Use this function to load remotes (e.g. in the routing config):
// import { loadRemoteModule } from '@angular-architects/module-federation/runtime';
//

import('./bootstrap');

`;
    } else {
      newMainContent =
        "import('./bootstrap')\n\t.catch(err => console.error(err));\n";
    }

    tree.overwrite(main, newMainContent);
  };
}

function getWorkspaceFileName(tree: Tree): string {
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

function updatePackageJson(
  tree: Tree,
  projectName: string,
  projectRoot: string,
  deps: Record<string, string>,
  devDeps: Record<string, string>
): void {
  const packageJson: PackageJson = JSON.parse(
    tree.read('package.json').toString('utf-8')
  );

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }

  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  packageJson.dependencies = {
    ...packageJson.dependencies,
    ...deps,
  };

  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    ...devDeps,
  };

  if (!packageJson.scripts['run:all']) {
    packageJson.scripts['run:all'] =
      'node node_modules/@angular-architects/module-federation/src/server/mf-dev-server.js';
  }

  const prefix = projectRoot ? `cd ${projectRoot} && ` : '';

  const startScriptName = `start:${projectName}`;
  const buildScriptName = `build:${projectName}`;

  packageJson.scripts[startScriptName] = `${prefix}rsbuild dev`;
  packageJson.scripts[buildScriptName] = `${prefix}rsbuild build`;

  if (!projectRoot && packageJson.scripts['start']) {
    packageJson.scripts['original-start'] = packageJson.scripts['start'];
  }

  if (!projectRoot && packageJson.scripts['build']) {
    packageJson.scripts['original-build'] = packageJson.scripts['build'];
  }

  if (!projectRoot) {
    packageJson.scripts['start'] = `rsbuild dev`;
    packageJson.scripts['build'] = `rsbuild build`;
  }

  printScriptInfo(projectRoot, startScriptName, buildScriptName);

  tree.overwrite('package.json', JSON.stringify(packageJson, null, 2));
}

function printScriptInfo(projectRoot: string, startScriptName: string, buildScriptName: string) {
  console.info();
  console.info(
    `[INFO] Please remember that the rspack integration is in early stages`
  );
  console.info(
    `[INFO] Use the following script to start and build your project:`
  );

  if (projectRoot) {
    console.info(
      `[INFO] npm run ${startScriptName}, npm run ${buildScriptName}`
    );
  } else {
    console.info(`[INFO] npm start, npm run build`);
  }
  console.info();
}

async function generateRsBuildConfig(
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
      tmpl: '',
    }),
    move(projectRoot),
  ]);

  return mergeWith(applied);
}

function writeProjectConfig(
  tree,
  workspaceFileName: string,
  workspace: unknown
) {
  tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, '\t'));
}

function updateLocalTsConfig(projectRoot: string, tree) {
  const localTsConfig = path.join(projectRoot, 'tsconfig.app.json');
  if (tree.exists(localTsConfig)) {
    updateTsConfig(tree, localTsConfig);
  }
}

function updateProjectConfig(projectConfig: ProjectConfig) {
  if (projectConfig?.architect?.build) {
    projectConfig.architect['original-build'] = projectConfig.architect.build;
    delete projectConfig.architect.build;
  }

  if (projectConfig?.architect?.serve) {
    projectConfig.architect['original-serve'] = projectConfig.architect.serve;
    delete projectConfig.architect.serve;
  }
}

function generteManifest(
  tree,
  manifestPath: string,
  remoteMap: Record<string, never>
) {
  tree.create(manifestPath, JSON.stringify(remoteMap, null, '\t'));
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

function generateRemoteMap(workspace: WorkspaceConfig, projectName: string) {
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
