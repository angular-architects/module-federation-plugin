import path = require("path");
import { noop } from "rxjs";
import { getWorkspaceFileName } from "../mf/schematic";
import { BootAsyncSchema } from "./schema";
import { Rule } from '@angular-devkit/schematics';

export default function bootAsync(options: BootAsyncSchema): Rule {

    return async function (tree) {
        const workspaceFileName = getWorkspaceFileName(tree);

        const workspace =
          JSON.parse(tree.read(workspaceFileName).toString('utf8'));
    
        if (!options.project) {
          options.project = workspace.defaultProject;
        }
    
        if (!options.project) {
          throw new Error(`No default project found. Please specifiy a project name!`)
        }
    
        const projectName = options.project;
        const projectConfig = workspace.projects[projectName];

        if (!projectConfig?.architect?.build?.options?.main) {
          throw new Error(`architect.build.options.main not found for project ` + projectName);
        }

        const currentMain = projectConfig.architect.build.options.main;
        const newMainFile = options.async ? 'main.ts' : 'bootstrap.ts';
        const newMain = path.join(path.dirname(currentMain), newMainFile).replace(/\\/g, '/');
        projectConfig.architect.build.options.main = newMain;

        tree.overwrite(workspaceFileName, JSON.stringify(workspace, null, 2));

        return noop();
    }
}
