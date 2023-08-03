import * as fs from 'fs';
import * as path from 'path';

export type ProjectType = 'application' | 'library';

export interface NxOrCliWorkspaceDef {
  projects: {
    [name: string]: Project | string;
  };
}

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
  const nxOrCliWorspaceDef = JSON.parse(content) as NxOrCliWorkspaceDef;
  const worspaceDef = toCliWorkspaceDef(nxOrCliWorspaceDef);
  return worspaceDef;
}

function toCliWorkspaceDef(def: NxOrCliWorkspaceDef): WorkspaceDef {
  const result: WorkspaceDef = { projects: {} };
  for (const key in def.projects) {
    const project = def.projects[key];

    if (typeof project === 'string') {
      const def = path.join(project, 'project.json');
      result.projects[key] = loadProjectDef(def);
    } else {
      result.projects[key] = project;
    }
  }
  return result;
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

function loadProjectDef(projectDef: string): Project {
  try {
    const def = JSON.parse(fs.readFileSync(projectDef, 'utf-8'));
    if (!def.architect) {
      def.architect = def.targets;
    }
    return def;
  } catch {
    throw new Error(
      `File ${projectDef} not found. Please start this command from your workspace root.`
    );
  }
}
