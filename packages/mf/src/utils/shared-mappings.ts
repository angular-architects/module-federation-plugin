import {NormalModuleReplacementPlugin} from 'webpack';
import * as path from 'path';
import * as fs from 'fs';
import * as JSON5  from 'json5';


interface KeyValuePair {
    key: string;
    value: string;
}

export class SharedMappings {

    private mappings: KeyValuePair[] = [];

    register(tsConfigPath: string, shared: string[] = null): void {

        if (!path.isAbsolute(tsConfigPath)) {
            throw new Error('SharedMappings.register: tsConfigPath needs to be an absolute path!');
        }

        const tsConfig = JSON5.parse(
            fs.readFileSync(tsConfigPath, {encoding: 'UTF8'}));
        const mappings = tsConfig?.compilerOptions?.paths;
        const rootPath = path.normalize(path.dirname(tsConfigPath));

        if (!mappings) {
            return;
        }

        for (const key in mappings) {
            if (!shared || shared.length === 0 || shared.includes(key)) {
                this.mappings.push({
                    key,
                    value: path.normalize(path.join(rootPath, mappings[key][0]))
                });
            }
        }
    }

    getPlugin(): NormalModuleReplacementPlugin {
        return new NormalModuleReplacementPlugin(/./, (req) => {
            const from = req.context;
            const to = path.normalize(path.join(req.context, req.request));

            if (!req.request.startsWith('.')) return;

            for (const m of this.mappings) {
                const libFolder = path.normalize(path.dirname(m.value));
                if (!from.startsWith(libFolder) && to.startsWith(libFolder)) {
                    req.request = m.key;
                    // console.log('remapping', { from, to, libFolder });
                }
            }
        });
    }

    getDescriptors(): object {
        const result = {};

        for (const m of this.mappings) {
            result[m.key] = {
                import: m.value,
                requiredVersion: false
            };
        }

        return result;
    }

    getDescriptor(mappedPath: string, requiredVersion: string = null): any {

        if (!this.mappings[mappedPath]) {
            throw new Error('No mapping found for ' + mappedPath + ' in tsconfig');
        }

        return ({
            [mappedPath]: {
                import: this.mappings[mappedPath],
                requiredVersion: requiredVersion ?? false
            }
        });
    }
}
