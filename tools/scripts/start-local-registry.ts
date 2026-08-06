/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */
import { ChildProcess, execFileSync, execSync, fork } from 'child_process';
import * as path from 'path';

const listenAddress = 'localhost';
const port = 4873;
const registry = `http://${listenAddress}:${port}`;
const authToken = 'secretVerdaccioToken';

// `@nx/js:verdaccio` starts the registry via `require.resolve(
// 'verdaccio/bin/verdaccio')`, a subpath verdaccio 6 no longer lists in its
// exports map. The executor throws ERR_PACKAGE_PATH_NOT_EXPORTED but the target
// still exits 0, so the registry silently never comes up. `package.json` is
// exported, so we locate the CLI relative to that and start it ourselves.
function resolveVerdaccioBin(): string {
  return path.join(
    path.dirname(require.resolve('verdaccio/package.json')),
    'bin',
    'verdaccio',
  );
}

// A registry left over from an earlier run answers the readiness ping on the
// first poll, so we would report success for a child that is about to die on
// EADDRINUSE. Refuse to start rather than silently adopt someone else's server.
async function assertPortIsFree(): Promise<void> {
  try {
    await fetch(`${registry}/-/ping`);
  } catch {
    return;
  }

  throw new Error(
    `Something is already listening on ${registry}. Stop the stale local registry before starting a new one.`,
  );
}

async function waitUntilReady(
  childProcess: ChildProcess,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
      throw new Error(
        `Local registry exited before it was ready (code ${childProcess.exitCode}).`,
      );
    }

    try {
      if ((await fetch(`${registry}/-/ping`)).ok) {
        return;
      }
    } catch {
      // Not accepting connections yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Local registry did not start on ${registry} in time`);
}

// verdaccio ignores SIGTERM while it still holds keep-alive connections, so a
// plain kill() leaves it running and orphaned. Escalate to SIGKILL.
function shutdown(childProcess: ChildProcess): Promise<void> {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const force = setTimeout(() => childProcess.kill('SIGKILL'), 5_000);
    force.unref();

    childProcess.once('exit', () => {
      clearTimeout(force);
      resolve();
    });

    childProcess.kill('SIGTERM');
  });
}

/** Starts verdaccio and points npm at it. Returns the shutdown callback. */
export async function startLocalRegistry(): Promise<() => Promise<void>> {
  await assertPortIsFree();

  const childProcess = fork(
    resolveVerdaccioBin(),
    ['--config', path.join('.verdaccio', 'config.yml'), '--listen', `${port}`],
    { stdio: 'pipe' },
  );

  childProcess.stderr?.on('data', (data) => process.stderr.write(data));

  await waitUntilReady(childProcess);
  console.log(`Local registry started on ${registry}`);

  // .verdaccio/config.yml grants anonymous publish rights, but npm still
  // refuses to publish without a token, so give it one.
  process.env.npm_config_registry = registry;
  execSync(
    `npm config set //${listenAddress}:${port}/:_authToken "${authToken}" --ws=false`,
    { windowsHide: true },
  );

  return async () => {
    execSync(
      `npm config delete //${listenAddress}:${port}/:_authToken --ws=false`,
      { windowsHide: true },
    );
    await shutdown(childProcess);
  };
}

export default async () => {
  global.stopLocalRegistry = await startLocalRegistry();

  const nx = require.resolve('nx');
  execFileSync(
    nx,
    ['run-many', '--targets', 'publish', '--ver', '0.0.0-e2e', '--tag', 'e2e'],
    { env: process.env, stdio: 'inherit' },
  );
};
