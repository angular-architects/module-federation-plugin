//
// We stick with rollup for bundling shared npm packages, as esbuild
// does currently not allow to convert commonjs to esm
//

import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import { externals } from 'rollup-plugin-node-externals';
import { logger } from '@softarc/native-federation/build';
import { terser } from 'rollup-plugin-terser';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const commonjs = require('@rollup/plugin-commonjs');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const replace = require('@rollup/plugin-replace');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const json = require('@rollup/plugin-json');

// eslint-disable-next-line @typescript-eslint/no-var-requires

export async function runRollup(
  entryPoint: string,
  external: string[],
  outfile: string
) {
  try {
    const result = await rollup({
      input: entryPoint,
      onwarn: (warning) => {
        logger.verbose(warning);
      },
      plugins: [
        json(),
        commonjs(),
        externals({ include: external }),
        resolve(),
        replace({
          preventAssignment: true,
          values: {
            'process.env.NODE_ENV': '"development"',
          },
        }),
        terser({ mangle: false, format: { comments: false } }),
      ],
    });

    await result.write({
      format: 'esm',
      compact: true,
      file: outfile,
      sourcemap: true,
      exports: 'named',
    });
  } catch (e) {
    logger.error('Rollup error');
    throw e;
  }
}
