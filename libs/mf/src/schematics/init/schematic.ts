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

import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

import {
  addPackageJsonDependency,
  getPackageJsonDependency,
  NodeDependencyType,
} from '@schematics/angular/utility/dependencies';
import { InitSchema } from './schema';

export default function init(options: InitSchema): Rule {
  return async function (tree, context) {
    console.log('options', options);
  }
}

