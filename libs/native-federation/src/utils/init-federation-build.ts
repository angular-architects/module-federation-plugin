import { BuildAdapter, BuildHelperParams, FederationOptions, MappedPath, federationBuilder } from '@softarc/native-federation/build';
import { dirname, join } from "path";

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = dirname(tsConfig);
  const relConfigPath = join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}
/**
 * @param entries external deps obj, adapter should fill
 * @returns file names array. Native Federation would think they are already built and fill remoteEntry.json with their data
 */
const getMockAdapter = (entries: Record<string, string>): BuildAdapter => {
  return ({entryPoints}) => {
    entryPoints.forEach(entry => {
      // angular builder manage ext itself
      // if not do this, output file would be soms line foo-bar.js.js
      const name = entry.outName.replace('.js', '');

      if (!entries[name]) {
        entries[name] = entry.fileName;
      }
    });
  
    const res = entryPoints.map(entry => ({fileName: entry.outName}));
  
    return Promise.resolve(res);
  }
}

interface InitFederationBuildData {
  entries: Record<string, string>;
  sharedMappings: MappedPath[];
  externals: string[]
}

/**
 * initiating native federation for build
 * 
 * 1. bundler should think {@link InitFederationBuildData.externals} are external deps and not include them into bundle
 * 2. bundler should build every entry from {@link InitFederationBuildData.entries} as independent file
 * 
 * @param root root dir (like contest.workspaceRoot)
 * @param outputPath path to store remoteEntry.json (soms like dist/<project name>/browser)
 * @param tsConfPath path to application's tsconfig
 * @returns all the federation data {@link InitFederationBuildData}
 */
export const initFederationBuild = async (root: string, outputPath: string, tsConfPath): Promise<InitFederationBuildData> => {
  // entries obj, it'll be filled by adapter
  const fedEntries: Record<string, string> = {};
  const mockAdapter: BuildAdapter = getMockAdapter(fedEntries);

  const fedOptions: FederationOptions = {
    workspaceRoot: root,
    outputPath: outputPath,
    federationConfig: infereConfigPath(tsConfPath),
    tsConfig: tsConfPath,
    verbose: false,
    watch: false,
    dev: true,
  };

  const params: BuildHelperParams = {
    options: fedOptions,
    adapter: mockAdapter,
  }
  
  
  await federationBuilder.init(params);

  // after this line federationBuilder will call mockAdapter and fill remoteEntry.json with it's result
  // 1. when fired, mockAdapter will fill fedEntries with file names and their pathes, builder should build
  // 2. remoteEntry.json will store deps list with files names. Each file should contain it's dependency content. It's important for builder not to rename those files
  await federationBuilder.build();

  return {
    entries: fedEntries,
    sharedMappings: federationBuilder.config.sharedMappings,
    externals: federationBuilder.externals,
  };
}