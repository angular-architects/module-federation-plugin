import { Rule, Tree } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
  addPackageJsonDependency,
  getPackageJsonDependency,
  NodeDependencyType,
  removePackageJsonDependency,
} from '@schematics/angular/utility/dependencies';

import { getWorkspaceFileName } from '../init-webpack/schematic';

// Maps every ngx-build-plus builder to its @angular-builders/custom-webpack
// equivalent. The dev-server inherits the webpack config from its build
// target, so it never carries its own config option (see below).
const BUILDER_MAP: Record<string, string> = {
  'ngx-build-plus:browser': '@angular-builders/custom-webpack:browser',
  'ngx-build-plus:dev-server': '@angular-builders/custom-webpack:dev-server',
  'ngx-build-plus:server': '@angular-builders/custom-webpack:server',
  'ngx-build-plus:extract-i18n':
    '@angular-builders/custom-webpack:extract-i18n',
};

const CUSTOM_WEBPACK_VERSION = '^22.0.0';

export default function migrateToCustomWebpack(): Rule {
  return function (tree: Tree, context) {
    const workspaceFileName = getWorkspaceFileName(tree);
    const workspace = JSON.parse(tree.read(workspaceFileName).toString('utf8'));

    let touched = false;

    for (const projectName of Object.keys(workspace.projects ?? {})) {
      const architect = workspace.projects[projectName]?.architect;
      if (!architect) {
        continue;
      }

      for (const targetName of Object.keys(architect)) {
        const target = architect[targetName];
        const mapped = BUILDER_MAP[target?.builder];
        if (!mapped) {
          continue;
        }

        target.builder = mapped;
        touched = true;

        // The dev-server takes its webpack config from the build target, so
        // any extraWebpackConfig on it is stale and must simply be dropped.
        const isDevServer = mapped.endsWith(':dev-server');
        convertOptions(target.options, isDevServer);
        for (const configName of Object.keys(target.configurations ?? {})) {
          convertOptions(target.configurations[configName], isDevServer);
        }
      }
    }

    if (touched) {
      tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, 2));
    }

    const hadNgxBuildPlus = !!getPackageJsonDependency(tree, 'ngx-build-plus');
    if (hadNgxBuildPlus) {
      removePackageJsonDependency(tree, 'ngx-build-plus');
    }

    // Only add custom-webpack if a project actually used the webpack path.
    if (
      touched &&
      !getPackageJsonDependency(tree, '@angular-builders/custom-webpack')
    ) {
      addPackageJsonDependency(tree, {
        name: '@angular-builders/custom-webpack',
        type: NodeDependencyType.Dev,
        version: CUSTOM_WEBPACK_VERSION,
        overwrite: true,
      });
    }

    if (touched || hadNgxBuildPlus) {
      context.addTask(new NodePackageInstallTask());
    }
  };
}

function convertOptions(
  options: Record<string, unknown> | undefined,
  isDevServer: boolean,
): void {
  if (!options || !('extraWebpackConfig' in options)) {
    return;
  }

  const value = options['extraWebpackConfig'];
  delete options['extraWebpackConfig'];

  if (isDevServer) {
    return;
  }

  // ngx-build-plus accepted a bare string path; custom-webpack expects
  // { path }. Preserve an already-object value defensively.
  options['customWebpackConfig'] =
    typeof value === 'string' ? { path: value } : value;
}
