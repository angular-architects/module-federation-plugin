import * as fs from 'fs';

export type ProjectType = 'application' | 'library';

export interface WorkspaceDef {
  projects: {
    [name: string]: Project;
  };
}

export interface Project {
  projectType: ProjectType;
  sourceRoot: string;
  architect: { [key: string]: Target };
}

export interface Target {
  options: {
    port?: number;
    outputPath?: string;
  };
}

export interface ProjectInfo {
  name: string;
  projectType: ProjectType;
  sourceRoot: string;
  port?: number;
  outputPath?: string;
}

function getWorkspaceFileName(): string {
  if (fs.existsSync('angular.json')) {
    return 'angular.json';
  }
  if (fs.existsSync('workspace.json')) {
    return 'workspace.json';
  }
  return null;
}

export function isWorkspace(): boolean {
  return getWorkspaceFileName() !== null;
}

export function readWorkspaceDef(): WorkspaceDef {
  const fileName = getWorkspaceFileName();
  if (!fileName) {
    throw new Error('This is not an Angular workspace!');
  }
  const content = fs.readFileSync(fileName, { encoding: 'utf-8' });
  return JSON.parse(content);
}

export function readProjectInfos(): ProjectInfo[] {
  const workspace = readWorkspaceDef();
  const projectNames = Object.keys(workspace.projects);

  return projectNames.map(
    (name) =>
      ({
        ...workspace.projects[name],
        name,
        port: workspace.projects[name].architect?.serve?.options?.port,
        outputPath:
          workspace.projects[name].architect?.build?.options?.outputPath,
      } as ProjectInfo)
  );
}
