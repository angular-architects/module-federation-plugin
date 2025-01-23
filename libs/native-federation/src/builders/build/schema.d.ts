import { JsonObject } from '@angular-devkit/core';
import type { ESMSInitOptions } from 'es-module-shims';
import { PluginConfig } from '../../utils/custom-plugins/custom-plugins.entity';

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
  ssr: boolean;
  plugins?: PluginConfig[];
} // eslint-disable-line
