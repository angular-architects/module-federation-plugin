import { BuildAdapterOptions, getBuildAdapter } from './build-adapter';

export async function bundle(options: BuildAdapterOptions) {
  const adapter = getBuildAdapter();
  await adapter(options);
}
