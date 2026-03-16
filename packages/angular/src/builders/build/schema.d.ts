import type { JsonObject } from '@angular-devkit/core';
import type { BuildNotificationOptions } from '@softarc/native-federation-runtime';
import type { ESMSInitOptions } from 'es-module-shims';

export interface NfBuilderSchema extends JsonObject {
  target: string;
  dev: boolean;
  port: number;
  rebuildDelay: number;
  buildNotifications?: BuildNotificationOptions;
  watch: boolean;
  skipHtmlTransform: boolean;
  esmsInitOptions: ESMSInitOptions;
  baseHref?: string;
  outputPath?: string;
  ssr: boolean;
  devServer?: boolean;
  chunks?: { enable: boolean; dense: true };
  /**
   * @deprecated: Use entryPoints instead
   */
  entryPoint?: string;
  entryPoints?: string[];
  cacheExternalArtifacts?: boolean;
} // eslint-disable-line
