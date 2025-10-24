import * as fs from 'node:fs';

export type FStartArgs = {
  entry: string;
  relBundlePath: string;
  remotesOrManifestUrl: string;
};

const defaultArgs: FStartArgs = {
  entry: './server.mjs',
  remotesOrManifestUrl: '../browser/federation.manifest.json',
  relBundlePath: '../browser/',
};

export function parseFStartArgs() {
  const args: FStartArgs = {
    entry: '',
    remotesOrManifestUrl: '',
    relBundlePath: '',
  };

  let key = '';
  for (let i = 2; i < process.argv.length; i++) {
    const cand = process.argv[i];

    if (cand.startsWith('--')) {
      const candKey = cand.substring(2);
      if (defaultArgs[candKey]) {
        key = candKey;
      } else {
        console.error(`switch ${cand} not supported!`);
        exitWithUsage(defaultArgs);
      }
    } else if (key) {
      args[key] = cand;
      key = '';
    } else {
      console.error(`unreladed value ${cand}!`);
      exitWithUsage(defaultArgs);
    }
  }

  applyDefaultArgs(args);

  return args;
}

function applyDefaultArgs(args: FStartArgs) {
  if (args.relBundlePath && !args.remotesOrManifestUrl) {
    const cand = defaultArgs.relBundlePath + 'federation.manifest.json';
    if (fs.existsSync(cand)) {
      args.remotesOrManifestUrl = cand;
    }
  }

  args.entry = args.entry || defaultArgs.entry;
  args.relBundlePath = args.relBundlePath || defaultArgs.relBundlePath;
  args.remotesOrManifestUrl =
    args.remotesOrManifestUrl || defaultArgs.remotesOrManifestUrl;

  if (!fs.existsSync(args.remotesOrManifestUrl)) {
    args.remotesOrManifestUrl = undefined;
  }
}

function exitWithUsage(defaultArgs: FStartArgs) {
  let args = '';
  for (const key in defaultArgs) {
    args += `[--${key} ${defaultArgs[key]}] `;
  }

  console.log('usage: nfstart ' + args);
  process.exit(1);
}
