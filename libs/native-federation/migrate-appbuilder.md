# Migrating to Native Federation 17.1

Beginning with version 17.1, Native Federation uses the CLI's Application Builder and Dev Server to keep track with the innovations and performance improvements the CLI team works on.

This requires some changes in the `angular.json`. If you go with a default configuration for Native Federation, the following command takes care of them:

```
ng g @angular-architects/native-federation:appbuilder
```

You need to run this command for each application using Native Federation.

For more advanced cases, please find a diff of the changes needed for this version:

```diff
 {
        "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
        "version": 1,
        "newProjectRoot": "projects",
        "projects": {
                "nf17x0a": {
                        "projectType": "application",
                        "schematics": {},
                        "root": "",
                        "sourceRoot": "src",
                        "prefix": "app",
                        "architect": {
                                "build": {
                                        "builder": "@angular-architects/native-federation:build",
                                        "options": {},
                                        "configurations": {
                                                "production": {
                                                        "target": "nf17x0a:esbuild:production"
                                                },
                                                "development": {
                                                        "target": "nf17x0a:esbuild:development",
                                                        "dev": true
                                                }
                                        },
                                        "defaultConfiguration": "production"
                                },
                                "serve": {
                                        "builder": "@angular-architects/native-federation:build",
                                        "options": {
-                                               "target": "nf17x0a:esbuild:development",
+                                               "target": "nf17x0a:serve-original:development",
                                                "rebuildDelay": 0,
-                                               "dev": true,
-                                               "port": 4200
+                                               "dev": true
                                        }
                                },
                                "extract-i18n": {
                                        "builder": "@angular-devkit/build-angular:extract-i18n",
                                        "options": {
                                                "buildTarget": "nf17x0a:build"
                                        }
                                },
                                "test": {
                                        "builder": "@angular-devkit/build-angular:karma",
                                        "options": {
                                                "polyfills": [
                                                        "zone.js",
                                                        "zone.js/testing"
                                                ],
                                                "tsConfig": "tsconfig.spec.json",
                                                "assets": [
                                                        "src/favicon.ico",
                                                        "src/assets"
                                                ],
                                                "styles": [
                                                        "src/styles.css"
                                                ],
                                                "scripts": []
                                        }
                                },
                                "esbuild": {
-                                       "builder": "@angular-devkit/build-angular:browser-esbuild",
+                                       "builder": "@angular-devkit/build-angular:application",
                                        "options": {
                                                "outputPath": "dist/nf17x0a",
                                                "index": "src/index.html",
                                                "polyfills": [
                                                        "zone.js",
                                                        "es-module-shims"
                                                ],
                                                "tsConfig": "tsconfig.app.json",
                                                "assets": [
                                                        "src/favicon.ico",
                                                        "src/assets"
                                                ],
                                                "styles": [
                                                        "src/styles.css"
                                                ],
                                                "scripts": [],
-                                               "main": "src/main.ts"
+                                               "browser": "src/main.ts"
                                        },
                                        "configurations": {
                                                "production": {
                                                        "budgets": [
                                                                {
                                                                        "type": "initial",
                                                                        "maximumWarning": "500kb",
                                                                        "maximumError": "1mb"
                                                                },
                                                                {
                                                                        "type": "anyComponentStyle",
                                                                        "maximumWarning": "2kb",
                                                                        "maximumError": "4kb"
                                                                }
                                                        ],
                                                        "outputHashing": "all"
                                                },
                                                "development": {
                                                        "optimization": false,
                                                        "extractLicenses": false,
                                                        "sourceMap": true
                                                }
                                        },
                                        "defaultConfiguration": "production"
                                },
                                "serve-original": {
                                        "builder": "@angular-devkit/build-angular:dev-server",
                                        "configurations": {
                                                "production": {
-                                                       "buildTarget": "nf17x0a:build:production"
+                                                       "buildTarget": "nf17x0a:esbuild:production"
                                                },
                                                "development": {
-                                                       "buildTarget": "nf17x0a:build:development"
+                                                       "buildTarget": "nf17x0a:esbuild:development"
                                                }
                                        },
                                        "defaultConfiguration": "development"
                                }
                        }
                }
        }
 }

```
