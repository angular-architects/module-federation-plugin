import { JsonObject } from '@angular-devkit/core';

export interface NfBuilderSchema extends JsonObject {
  target: string;
  dev: boolean;
  port: number;
  open: boolean;
  rebuildDelay: number;
  shell: string;
  watch: boolean;
  skipHtmlTransform: boolean;
} // eslint-disable-line
