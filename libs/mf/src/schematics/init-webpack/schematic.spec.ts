import { generateSsrMappings } from './schematic';

// Angular 22 no longer writes outputPath into angular.json, so these fixtures
// mirror what `ng new` + `ng generate application` actually emit: the default
// project at the workspace root, the second one under projects/.
type ProjectOverrides = {
  buildOptions?: Record<string, unknown>;
  port?: number;
  projectType?: string;
};

function project({
  buildOptions = {},
  port = 4200,
  projectType = 'application',
}: ProjectOverrides = {}) {
  return {
    projectType,
    architect: {
      build: { options: { ...buildOptions } },
      serve: { options: { port } },
    },
  };
}

function workspace(projects: Record<string, ReturnType<typeof project>>) {
  return { projects };
}

describe('generateSsrMappings', () => {
  it('falls back to dist/<project> when outputPath is absent', () => {
    const result = generateSsrMappings(
      workspace({
        shell: project({ port: 4200 }),
        mfe1: project({ port: 4201 }),
      }),
      'shell',
    );

    // Relative from dist/shell to dist/mfe1.
    expect(result).toContain(`join(__dirname, '../mfe1/')`);
    expect(result).toContain(`'http://localhost:4201/'`);
  });

  it('honours an explicit string outputPath', () => {
    const result = generateSsrMappings(
      workspace({
        shell: project({ buildOptions: { outputPath: 'dist/apps/shell' } }),
        mfe1: project({
          buildOptions: { outputPath: 'dist/apps/mfe1' },
          port: 4201,
        }),
      }),
      'shell',
    );

    expect(result).toContain(`join(__dirname, '../mfe1/')`);
  });

  it('unwraps the application builder object form of outputPath', () => {
    const result = generateSsrMappings(
      workspace({
        shell: project({
          buildOptions: { outputPath: { base: 'dist/shell', browser: '' } },
        }),
        mfe1: project({
          buildOptions: { outputPath: { base: 'dist/mfe1', browser: '' } },
          port: 4201,
        }),
      }),
      'shell',
    );

    expect(result).toContain(`join(__dirname, '../mfe1/')`);
  });

  it('skips libraries and the project being initialised', () => {
    const result = generateSsrMappings(
      workspace({
        shell: project(),
        somelib: project({ projectType: 'library' }),
      }),
      'shell',
    );

    expect(result).toBe('{\n}');
  });
});
