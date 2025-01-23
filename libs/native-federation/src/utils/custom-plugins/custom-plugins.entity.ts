/*
 * Stolen from https://github.com/just-jeb/angular-builders/blob/master/packages/custom-esbuild/src/load-plugins.ts
 */

export type PluginConfig = string | { path: string; options?: Record<string, unknown> };