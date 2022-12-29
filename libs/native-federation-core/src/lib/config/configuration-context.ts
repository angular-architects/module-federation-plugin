export interface ConfigurationContext {
  workspaceRoot?: string;
}

let _context: ConfigurationContext = {};

export function useWorkspace(workspaceRoot: string): void {
  _context = {..._context, workspaceRoot};
}

export function getConfigContext(): ConfigurationContext {
  return _context;
}
