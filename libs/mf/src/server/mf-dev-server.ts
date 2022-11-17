import { exec } from 'child_process';
import { isWorkspace, ProjectInfo, readProjectInfos } from './workspace';
import { print } from './colors';
import { argv } from 'process';

let padding;

function startCmd(name: string, cmd: string): void {
  const process = exec(cmd);
  process.stdout.on('data', (chunk) => {
    print(name, padding, chunk);
  });
  process.stderr.on('data', (chunk) => {
    print(name, padding, chunk, true);
  });
}

// tslint:disable-next-line: no-shadowed-variable
function startApps(apps: ProjectInfo[]): void {
  for (const app of apps) {
    const cmd = `ng serve ${app.name} -o`;
    print('DEVSVR', padding, app.name + ' ' + (app.port || '4200'));
    startCmd(app.name, cmd);
  }
}

if (!isWorkspace()) {
  console.error('This needs to be started in the root of an Angular project!');
  process.exit(0);
}

const [, , ...filter] = argv;
const startAll = filter.length === 0;

const projects = readProjectInfos();
const apps = projects.filter(
  (p) =>
    p.projectType === 'application' &&
    !p.name.endsWith('-e2e') &&
    (startAll || filter.includes(p.name))
);
padding = apps.reduce((acc, p) => Math.max(acc, p.name.length), 0);
padding = Math.max(6, padding);
startApps(apps);
