import { Rule } from '@angular-devkit/schematics';
import {
  addPackageJsonDependency,
  NodeDependencyType,
} from '@schematics/angular/utility/dependencies';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

export function index(): Rule {
  return async function (tree, context) {
    addPackageJsonDependency(tree, {
      name: 'ngx-build-plus',
      type: NodeDependencyType.Dev,
      version: '^14.0.0',
      overwrite: true,
    });

    context.addTask(new NodePackageInstallTask());
  };
}
