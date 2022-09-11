import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import { externals } from 'rollup-plugin-node-externals';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const commonjs = require('@rollup/plugin-commonjs');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const replace = require('@rollup/plugin-replace');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const json = require('@rollup/plugin-json');


export async function prepareNodePackage(
  entryPoint: string,
  external: string[],
  outfile: string
) {
  console.log('Converting package to esm ...');

  try {
    const result = await rollup({
      input: entryPoint,

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
      ],
    });

    await result.write({
      format: 'esm',
      file: outfile,
      sourcemap: true,
      exports: 'named',
    });
  } catch (e) {
    console.error('Error', e);
  }
}
