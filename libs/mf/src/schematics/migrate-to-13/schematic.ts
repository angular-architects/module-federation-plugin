import { Rule } from '@angular-devkit/schematics';

export function index(): Rule {
  return async function (tree, context) {
    console.info(`!!!
Angular 13 compiles bundles as EcmaScript modules. 
Hence, we need to adjust how we use Module Federation. 
We've got you covered. Please find all information here:
https://github.com/angular-architects/module-federation-plugin/blob/main/migration-guide.md
!!!
`);
  };
}
