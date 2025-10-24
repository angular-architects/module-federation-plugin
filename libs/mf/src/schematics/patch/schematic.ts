import { noop, Rule } from '@angular-devkit/schematics';
import { execSync } from 'child_process';

//
// Schematic for patching Angular for rsbuild integration while experimental.
// Will be removed when stable!
// Called via the init-rspack schematic to execute it AFTER the task running
// npm install
//

export default function init(options: { workspaceRoot: string }): Rule {
  return async function () {
    const cmd =
      'node node_modules/@ng-rsbuild/plugin-angular/patch/patch-angular-build.js';

    try {
      execSync(cmd, {
        cwd: options.workspaceRoot,
      });
    } catch (e) {
      console.error('Error patching Angular for rspack');
      console.error(
        'This is only needed while the rspack integration is experimental'
      );
      console.error('Try to run this command by hand:');
      console.error('\t' + cmd);
      console.error('Error', e);
    }

    return noop();
  };
}
