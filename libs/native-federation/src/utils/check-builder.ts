import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Since Angular 16, the Angular CLI uses the new @angular/build package
 * Currently the @angular/build package is not installed by default
 * However in the next version of Angular (v20), it will replace the @angular-devkit/build-angular package
 *
 * This functions checks if the @angular/build package is installed to insure a compatibility with the next version of Angular
 * and insure also that if people migrate on Angular 20 and don't change the builder, it will not break the compatibility with this package in v20
 *
 * @returns true if the Angular build package is installed
 */
export const checkAngularBuildApplicationBuilder = () => {
  const pathAngularBuildPackage = resolve(
    process.cwd(),
    'node_modules',
    '@angular/build'
  );

  return existsSync(pathAngularBuildPackage);
};
