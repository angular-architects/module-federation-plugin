import { readCachedProjectGraph } from '@nx/devkit';
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

function invariant(condition, message) {
  if (!condition) {
    console.error(chalk.bold.red(message));
    process.exit(1);
  }
}

export function getProject(name) {
  const graph = readCachedProjectGraph();
  const project = graph.nodes[name];
  invariant(
    project,
    `Could not find project "${name}" in the workspace. Is the project.json configured correctly?`
  );
  return project;
}

export function getVersion(version, project) {
  // if version not provided, get the version from the package.json
  if (!version) {
    const packageJson = readPackageJsonFromPath(project.data.root);
    version = packageJson.version;
    console.log(
      `Not version provided, take version from package.json ${version}`
    );
  }

  // A simple SemVer validation to validate the version
  const validVersion = /^\d+\.\d+\.\d+(-\w+\.\d+)?/;
  invariant(
    version && validVersion.test(version),
    `No version provided or version did not match Semantic Versioning, expected: #.#.#-tag.# or #.#.#, got ${version}.`
  );

  return version;
}

export function getOutputPath(project) {
  console.log();
  let outputPath =
    project.data?.targets?.build?.options?.outputPath ||
    project.data?.targets?.build?.outputs?.[0];
  invariant(
    outputPath,
    `Could not find "build.options.outputPath" or "build.options.outputs" of project "${project.name}". Is project.json configured  correctly?`
  );

  outputPath = outputPath.replace('{workspaceRoot}/', '');

  console.log(`Use outputPath ${outputPath}`);

  return outputPath;
}

export function readPackageJsonFromPath(packageJsonPath) {
  try {
    return JSON.parse(
      readFileSync(join(packageJsonPath, `package.json`)).toString()
    );
  } catch (e) {
    console.error(
      chalk.bold.red(
        `Error reading package.json file from library build output.`
      )
    );
  }
}
