import { FederationOptions } from "@softarc/native-federation/build";
import { AngularBuildOutput } from "./angular-esbuild-adapter";
import { updateIndexHtml } from "./updateIndexHtml";
import { BuildOutputFile } from "@angular-devkit/build-angular/src/tools/esbuild/bundler-context";

// assuming that the files have already been written
export function prepareBundles(fedOptions: FederationOptions, buildOutput: AngularBuildOutput): void {
    // TODO: at this point we can also copy remoteEntry.json from root next to each index.html
    // TODO: remoteEntry.json-s that are copied should be transformed because they and exposed entries
    // go to language folders, but shared files go to dist root.
    // TODO:? import maps need to be copied and transformed like the remoteEntry-s. They're not used anywhere though.
    for (const indexFile of getIndexFiles(buildOutput)) {
        updateIndexHtml(indexFile);
    }
}

function getIndexFiles(buildOutput: AngularBuildOutput): BuildOutputFile[] {
    // TODO: filter also for these files to be in the browser area
    return buildOutput.outputFiles.filter(file => file.path.endsWith('index.html'));
}