import { JsonObject } from '@angular-devkit/core';
import type { ESMSInitOptions } from 'es-module-shims';

export interface NfBuilderSchema extends JsonObject {
  target: string;
  dev: boolean;
  port: number;
  open: boolean;
  rebuildDelay: number;
  shell: string;
  watch: boolean;
  skipHtmlTransform: boolean;
  esmsInitOptions: ESMSInitOptions;
  baseHref?: string;
  outputPath?: string;
  ssr: boolean;
  devServer?: boolean;
} // eslint-disable-line
