export const angularJson = `
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "mfe1": {
      "projectType": "application",
      "schematics": {},
      "root": "apps/mfe1",
      "sourceRoot": "apps/mfe1/src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "",
          "options": {
            "outputPath": "dist/mfe1",
            "index": "apps/mfe1/src/index.html",
            "main": "apps/mfe1/src/main.ts",
            "polyfills": "apps/mfe1/src/polyfills.ts",
            "tsConfig": "apps/mfe1/tsconfig.app.json",
            "aot": true,
            "assets": [
              "apps/mfe1/src/favicon.ico",
              "apps/mfe1/src/assets"
            ],
            "styles": [],
            "scripts": []
          },
          "configurations": {
            "production": {
              "fileReplacements": [
                {
                  "replace": "apps/mfe1/src/environments/environment.ts",
                  "with": "apps/mfe1/src/environments/environment.prod.ts"
                }
              ],
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "namedChunks": false,
              "extractLicenses": true,
              "vendorChunk": false,
              "buildOptimizer": true,
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "2mb",
                  "maximumError": "5mb"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "6kb",
                  "maximumError": "10kb"
                }
              ]
            }
          }
        },
        "serve": {
          "builder": "",
          "options": {
            "browserTarget": "mfe1:build"
          },
          "configurations": {
            "production": {
              "browserTarget": "mfe1:build:production"
            }
          }
        },
        "extract-i18n": {
          "builder": "@angular-devkit/build-angular:extract-i18n",
          "options": {
            "browserTarget": "mfe1:build"
          }
        },
        "test": {
          "builder": "",
          "options": {
            "main": "apps/mfe1/src/test.ts",
            "polyfills": "apps/mfe1/src/polyfills.ts",
            "tsConfig": "apps/mfe1/tsconfig.spec.json",
            "karmaConfig": "apps/mfe1/karma.conf.js",
            "assets": [
              "apps/mfe1/src/favicon.ico",
              "apps/mfe1/src/assets"
            ],
            "styles": [
              "apps/mfe1/src/styles.css"
            ],
            "scripts": []
          }
        },
        "lint": {
          "builder": "@angular-devkit/build-angular:tslint",
          "options": {
            "tsConfig": [
              "apps/mfe1/tsconfig.app.json",
              "apps/mfe1/tsconfig.spec.json",
              "apps/mfe1/e2e/tsconfig.json"
            ],
            "exclude": [
              "**/node_modules/**"
            ]
          }
        },
        "e2e": {
          "builder": "@angular-devkit/build-angular:protractor",
          "options": {
            "protractorConfig": "apps/mfe1/e2e/protractor.conf.js",
            "devServerTarget": "mfe1:serve"
          },
          "configurations": {
            "production": {
              "devServerTarget": "mfe1:serve:production"
            }
          }
        }
      }
    },
    "shell": {
      "projectType": "application",
      "schematics": {},
      "root": "apps/shell",
      "sourceRoot": "apps/shell/src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "",
          "options": {
            "outputPath": "dist/shell",
            "index": "apps/shell/src/index.html",
            "main": "apps/shell/src/main.ts",
            "polyfills": "apps/shell/src/polyfills.ts",
            "tsConfig": "apps/shell/tsconfig.app.json",
            "aot": true,
            "assets": [
              "apps/shell/src/favicon.ico",
              "apps/shell/src/assets"
            ],
            "styles": [],
            "scripts": []
          },
          "configurations": {
            "production": {
              "fileReplacements": [
                {
                  "replace": "apps/shell/src/environments/environment.ts",
                  "with": "apps/shell/src/environments/environment.prod.ts"
                }
              ],
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "namedChunks": false,
              "extractLicenses": true,
              "vendorChunk": false,
              "buildOptimizer": true,
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "2mb",
                  "maximumError": "5mb"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "6kb",
                  "maximumError": "10kb"
                }
              ]
            }
          }
        },
        "serve": {
          "builder": "",
          "options": {
            "browserTarget": "shell:build"
          },
          "configurations": {
            "production": {
              "browserTarget": "shell:build:production"
            }
          }
        },
        "extract-i18n": {
          "builder": "@angular-devkit/build-angular:extract-i18n",
          "options": {
            "browserTarget": "shell:build"
          }
        },
        "test": {
          "builder": "",
          "options": {
            "main": "apps/shell/src/test.ts",
            "polyfills": "apps/shell/src/polyfills.ts",
            "tsConfig": "apps/shell/tsconfig.spec.json",
            "karmaConfig": "apps/shell/karma.conf.js",
            "assets": [
              "apps/shell/src/favicon.ico",
              "apps/shell/src/assets"
            ],
            "styles": [],
            "scripts": []
          }
        },
        "lint": {
          "builder": "@angular-devkit/build-angular:tslint",
          "options": {
            "tsConfig": [
              "apps/shell/tsconfig.app.json",
              "apps/shell/tsconfig.spec.json",
              "apps/shell/e2e/tsconfig.json"
            ],
            "exclude": [
              "**/node_modules/**"
            ]
          }
        },
        "e2e": {
          "builder": "@angular-devkit/build-angular:protractor",
          "options": {
            "protractorConfig": "apps/shell/e2e/protractor.conf.js",
            "devServerTarget": "shell:serve"
          },
          "configurations": {
            "production": {
              "devServerTarget": "shell:serve:production"
            }
          }
        }
      }
    }
  },
  "defaultProject": "mfe1",
  "cli": {
    "packageManager": "yarn"
  }
}
`;

export const mainTsContent = `
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
`;
