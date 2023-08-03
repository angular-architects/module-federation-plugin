import { JsonObject } from '@angular-devkit/core';

export interface NfBuilderSchema extends JsonObject {
    target: string;
    dev: boolean;
    devServerPort: number;
    rebuildDelay: number;
    shell: string;
} // eslint-disable-line

