import * as fs from 'fs';
import * as path from 'path';

export function getEntryPoint(projectRoot: string, packageName: string): string {
    const mainPkgName = getPkgFolder(packageName);

    const mainPkgPath = path.join(projectRoot, 'node_modules', mainPkgName);
    const mainPkgJsonPath = path.join(mainPkgPath, 'package.json');

    if (!fs.existsSync(mainPkgPath)) {
        return null;
    }

    const mainPkgJson = readJson(mainPkgJsonPath);

    let relSecondaryPath = path.relative(mainPkgName,  packageName);
    if (!relSecondaryPath) {
        relSecondaryPath = '.';
    }
    else {
        relSecondaryPath = './' + relSecondaryPath
    }

    let cand = mainPkgJson?.exports?.[relSecondaryPath]?.default;
    if (cand) {
        return path.join(mainPkgPath, cand);
    }

    cand = mainPkgJson['module'];

    if (cand && relSecondaryPath === '.') {
        return path.join(mainPkgPath, cand);
    }

    const secondaryPgkPath = path.join(projectRoot, 'node_modules', packageName);
    const secondaryPgkJsonPath = path.join(secondaryPgkPath, 'package.json');
    let secondaryPgkJson: unknown = null;
    if (fs.existsSync(secondaryPgkJsonPath)) {
        secondaryPgkJson = readJson(secondaryPgkJsonPath);
    }

    if (secondaryPgkJson && secondaryPgkJson['module']) {
        return path.join(secondaryPgkPath, secondaryPgkJson['module']);
    }

    cand = path.join(secondaryPgkPath, 'index.mjs');
    if (fs.existsSync(cand)) {
        return cand;
    }

    cand = path.join(secondaryPgkPath, 'index.js');
    if (fs.existsSync(cand)) {
        return cand;
    }

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

// const r = getEntryPoint('D:/Dokumente/projekte/mf-plugin/angular-architects/', pkg);
// console.log('entry', r);