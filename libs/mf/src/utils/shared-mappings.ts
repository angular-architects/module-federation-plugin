import { NormalModuleReplacementPlugin } from 'webpack';
import * as path from 'path';
import * as fs from 'fs';
import * as JSON5 from 'json5';

interface Library {
  key: string;
  path: string;
  version?: string;
}

export class SharedMappings {
  private mappings: Library[] = [];

  register(
    tsConfigPath: string,
    shared: string[] = null,
    rootPath: string = path.normalize(path.dirname(tsConfigPath))
  ): void {
    if (!path.isAbsolute(tsConfigPath)) {
      throw new Error(
        'SharedMappings.register: tsConfigPath needs to be an absolute path!'
      );
    }

    const shareAll = !shared;

    if (!shared) {
      shared = [];
    }

    const tsConfig = JSON5.parse(
      fs.readFileSync(tsConfigPath, { encoding: 'utf-8' })
    );
    const mappings = tsConfig?.compilerOptions?.paths;

    if (!mappings) {
      return;
    }

    for (const key in mappings) {
      const libPath = path.normalize(path.join(rootPath, mappings[key][0]));
      const version = this.getPackageVersion(libPath);

      if (shared.includes(key) || shareAll) {
        this.mappings.push({
          key,
          path: libPath,
          version,
        });
      }
    }
  }

  private getPackageVersion(libPath: string) {
    if (libPath.endsWith('.ts')) {
      libPath = path.dirname(libPath);
    }

    const packageJsonPath = path.join(libPath, '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON5.parse(
        fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })
      );

      return packageJson.version ?? null;
    }
    return null;
  }

  getPlugin(): NormalModuleReplacementPlugin {
    return new NormalModuleReplacementPlugin(/./, (req) => {
      const from = req.context;
      const to = path.normalize(path.join(req.context, req.request));

      if (!req.request.startsWith('.')) return;

      for (const m of this.mappings) {
        const libFolder = path.normalize(path.dirname(m.path));
        if (!from.startsWith(libFolder) && to.startsWith(libFolder)) {
          req.request = m.key;
          // console.log('remapping', { from, to, libFolder });
        }
      }
    });
  }

  getAliases(): Record<string, string> {
    const result = {};

    for (const m of this.mappings) {
      result[m.key] = m.path;
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  getDescriptors(eager?: boolean): object {
    const result = {};

    for (const m of this.mappings) {
      result[m.key] = {
        requiredVersion: false,
        eager,
      };
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  getDescriptor(mappedPath: string, requiredVersion: string = null): object {
    const lib = this.mappings.find((m) => m.key === mappedPath);

    if (!lib) {
      throw new Error('No mapping found for ' + mappedPath + ' in tsconfig');
    }

    return {
      [mappedPath]: {
        import: lib.path,
        version: lib.version ?? undefined,
        requiredVersion: requiredVersion ?? false,
      },
    };
  }
}
