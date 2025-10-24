import { BuildAdapterOptions, getBuildAdapter } from '../core/build-adapter';

export async function bundle(options: BuildAdapterOptions) {
  const adapter = getBuildAdapter();
  return await adapter(options);
}
