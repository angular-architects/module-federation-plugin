import * as path from 'path';
import * as fs from 'fs';

export function patchAngularBuildPackageJson(packageJson: unknown): void {
    const exportsMap = packageJson['exports'];

    if (!exportsMap) {
        console.log('No need to patch @angular/build/package.json')
        return;
    }

    packageJson['_exports'] = exportsMap;
    delete packageJson['exports'];

    packageJson['types'] = './src/index.d.ts';
    packageJson['main'] = './src/index.js';
    packageJson['module'] = './src/index.js';
}

export function patchAngularBuild(workspaceRoot: string): void {
    const packagePath = path.join(workspaceRoot, 'node_modules/@angular/build/package.json');

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

    patchAngularBuildPackageJson(packageJson);

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

    console.log('@angular/build/package.json patched');
}