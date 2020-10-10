import {
  ensureNxProject,
  runNxCommandAsync,
} from '@nrwl/nx-plugin/testing';

import * as fs from 'fs';
import { angularJson } from './test-files';

describe('mf e2e', () => {
  it('should create mf', async (done) => {
    ensureNxProject('@angular-architects/module-federation', 'dist/packages/mf');
    
    fs.unlinkSync('tmp/nx-e2e/proj/workspace.json');
    fs.writeFileSync('tmp/nx-e2e/proj/angular.json', angularJson);
    fs.mkdirSync('tmp/nx-e2e/proj/apps/shell');

    await runNxCommandAsync(`generate @angular-architects/module-federation:config shell 5000`);

    expect(fs.existsSync('tmp/nx-e2e/proj/apps/shell/webpack.config.js')).toBeTruthy();
    expect(fs.existsSync('tmp/nx-e2e/proj/apps/shell/webpack.prod.config.js')).toBeTruthy();

    done();
  }, 90000);

 
});
