import { BuildAdapterOptions, getBuildAdapter } from '../core/build-adapter';

export async function bundle(options: BuildAdapterOptions) {
  const adapter = getBuildAdapter();
  await adapter(options);
}
