import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import {
  getOutputPath,
  getProject,
  getVersion,
  readPackageJsonFromPath,
} from './publish-utils.mjs';
import chalk from 'chalk';

// Executing publish script: node path/to/publish.mjs {project} {registry} {version} {tag}
// Default "tag" to "next" so we won't publish the "latest" tag by accident.
const [, , nameArgv, targetRegistry, versionArgv, tagArgv = 'latest'] =
  process.argv;

const project = getProject(nameArgv);
const version = getVersion(versionArgv, project);
const outputPath = getOutputPath(project);

process.chdir(outputPath);

// Updating the version in "package.json" before publishing
const packageJsonToPublish = readPackageJsonFromPath('');
packageJsonToPublish.version = version;

writeFileSync(`package.json`, JSON.stringify(packageJsonToPublish, null, 2));
console.log(`Update package.json with version ${version}`);

// Execute "npm publish" to publish
if (targetRegistry === 'npm') {
  console.log(`Publish to NPM`);
  execSync(`npm publish --access public --tag ${tagArgv}`);
} else if (targetRegistry === 'verdaccio') {
  console.log(`Publish to Verdaccio`);
  // First unpublished to be sure it does not exist
  execSync(
    `npm unpublish ${packageJsonToPublish.name}@${version} --registry http://localhost:4873 -f`
  );
  execSync(`npm publish --registry http://localhost:4873`);
} else {
  console.error(chalk.bold.red(`Registry ${targetRegistry} not supported`));
  process.exit(1);
}
