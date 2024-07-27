# Update to Native Federation for Angular 18

The package `@angular-architects/native-federation` version 18 was successfully tested with Angular 18.

## Option 1

Just use `ng update`:

```
ng update @angular-architects/native-federation
```

## Option 2

Use npm install:

```
npm i @angular-architects/native-federation@^18
```

Make sure you have the following `postinstall` script in your `package.json`:

```json
"scripts": {
    [...]
    "postinstall": "node node_modules/@angular-architects/native-federation/src/patch-angular-build.js"
},
```

**Remarks:** This script is just a temporary solution. It won't be necessary in future versions. 

Run the `postinstall` script once manually for initialization:

```
npm run postinstall
```
