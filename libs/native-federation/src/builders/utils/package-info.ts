import * as fs from 'fs';
import * as path from 'path';

export interface PackageInfo {
    packageName: string;
    entryPoint: string;
    version: string;
}

export function getPackageInfo(projectRoot: string, packageName: string): PackageInfo | null {
    const mainPkgName = getPkgFolder(packageName);

    const mainPkgPath = path.join(projectRoot, 'node_modules', mainPkgName);
    const mainPkgJsonPath = path.join(mainPkgPath, 'package.json');

    if (!fs.existsSync(mainPkgPath)) {
        console.warn('No package.json found for', packageName);
        return null;
    }

    const mainPkgJson = readJson(mainPkgJsonPath);

    const version = mainPkgJson['version'] as string;

    if (!version) {
        console.warn('No version found for', packageName);

        return null;
    }

    let relSecondaryPath = path.relative(mainPkgName,  packageName);
    if (!relSecondaryPath) {
        relSecondaryPath = '.';
    }
    else {
        relSecondaryPath = './' + relSecondaryPath
    }

    let cand = mainPkgJson?.exports?.[relSecondaryPath]?.default;
    if (cand) {
        return {
            entryPoint: path.join(mainPkgPath, cand),
            packageName,
            version
        };
    }

    cand = mainPkgJson['module'];

    if (cand && relSecondaryPath === '.') {
        return {
            entryPoint: path.join(mainPkgPath, cand),
            packageName,
            version
        };
    }

    const secondaryPgkPath = path.join(projectRoot, 'node_modules', packageName);
    const secondaryPgkJsonPath = path.join(secondaryPgkPath, 'package.json');
    let secondaryPgkJson: unknown = null;
    if (fs.existsSync(secondaryPgkJsonPath)) {
        secondaryPgkJson = readJson(secondaryPgkJsonPath);
    }

    if (secondaryPgkJson && secondaryPgkJson['module']) {
        return {
            entryPoint: path.join(secondaryPgkPath, secondaryPgkJson['module']),
            packageName,
            version
        };
    }

    cand = path.join(secondaryPgkPath, 'index.mjs');
    if (fs.existsSync(cand)) {
        return {
            entryPoint: cand,
            packageName,
            version
        };
    }

    cand = path.join(secondaryPgkPath, 'index.js');
    if (fs.existsSync(cand)) {
        return {
            entryPoint: cand,
            packageName,
            version
        };
    }

    console.warn('No esm-based entry point found for', packageName);

    return null;

} 

function readJson(mainPkgJsonPath: string) {
    return JSON.parse(fs.readFileSync(mainPkgJsonPath, 'utf-8'));
}

function getPkgFolder(packageName: string) {
    const parts = packageName.split('/');

    let folder = parts[0];

    if (folder.startsWith('@')) {
        folder += '/' + parts[1];
    }

    return folder;
}


// const pkg = process.argv[2]
// console.log('pkg', pkg);

// const r = getPackageInfo('D:/Dokumente/projekte/mf-plugin/angular-architects/', pkg);
// console.log('entry', r);