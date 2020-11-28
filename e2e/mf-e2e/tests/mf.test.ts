import { ensureNxProject, runNxCommandAsync } from '@nrwl/nx-plugin/testing';

import * as fs from 'fs';

describe('mf e2e', () => {
  it('should create mf based on angular-cli angular.json file', async (done) => {
    ensureNxProject(
      '@angular-architects/module-federation',
      'dist/packages/mf'
    );

    fs.unlinkSync('tmp/nx-e2e/proj/workspace.json');

    const angularJson = fs.readFileSync(
      'e2e/mf-e2e/tests/files/angular-cli.json'
    );
    fs.writeFileSync('tmp/nx-e2e/proj/angular.json', angularJson);

    fs.mkdirSync('tmp/nx-e2e/proj/apps/shell');
    fs.mkdirSync('tmp/nx-e2e/proj/apps/shell/src');

    const mainTs = fs.readFileSync('e2e/mf-e2e/tests/files/main.ts');
    fs.appendFileSync('tmp/nx-e2e/proj/apps/shell/src/main.ts', mainTs);

    await runNxCommandAsync(
      `generate @angular-architects/module-federation:config shell 5000`
    );

    expect(
      fs.existsSync('tmp/nx-e2e/proj/apps/shell/webpack.config.js')
    ).toBeTruthy();
    expect(
      fs.existsSync('tmp/nx-e2e/proj/apps/shell/webpack.prod.config.js')
    ).toBeTruthy();

    done();
  }, 90000);

  it('should create mf based on nx workspace angular.json file', async (done) => {
    ensureNxProject(
      '@angular-architects/module-federation',
      'dist/packages/mf'
    );

    fs.unlinkSync('tmp/nx-e2e/proj/workspace.json');

    const angularJson = fs.readFileSync(
      'e2e/mf-e2e/tests/files/angular-nx.json'
    );
    fs.writeFileSync('tmp/nx-e2e/proj/angular.json', angularJson);

    fs.mkdirSync('tmp/nx-e2e/proj/apps/shell');
    fs.mkdirSync('tmp/nx-e2e/proj/apps/shell/src');

    const mainTs = fs.readFileSync('e2e/mf-e2e/tests/files/main.ts');
    fs.appendFileSync('tmp/nx-e2e/proj/apps/shell/src/main.ts', mainTs);

    await runNxCommandAsync(
      `generate @angular-architects/module-federation:config shell 5000`
    );

    expect(
      fs.existsSync('tmp/nx-e2e/proj/apps/shell/webpack.config.js')
    ).toBeTruthy();
    expect(
      fs.existsSync('tmp/nx-e2e/proj/apps/shell/webpack.prod.config.js')
    ).toBeTruthy();

    done();
  }, 90000);
});
