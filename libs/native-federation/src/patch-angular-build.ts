import { patchAngularBuild } from './utils/patch-angular-build';

const workspaceRoot = process.cwd();
patchAngularBuild(workspaceRoot);
