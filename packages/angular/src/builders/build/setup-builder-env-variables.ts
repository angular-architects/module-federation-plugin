/**
 * Disables Angular's parallel caching and allows for
 * a shared cache between the compilation steps which
 * improves performance dramatically.
 */
process.env['NG_BUILD_PARALLEL_TS'] = '0';
