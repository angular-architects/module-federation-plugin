import { OutputFile } from 'esbuild';
import { basename } from 'path';

export interface BuildResult {
  fileName: string;
  get(): string;
}

export class EsBuildResult implements BuildResult {
  public fileName: string;

  constructor(private outputFile: OutputFile) {
    this.fileName = outputFile.path;
  }

  get(): string {
    return this.outputFile.text;
  }
}

export class MemResults {
  private map = new Map<string, BuildResult>();

  public add(result: BuildResult[]): void {
    for (const file of result) {
      this.map.set(basename(file.fileName), file);
    }
  }

  public get(fileName: string): BuildResult | undefined {
    return this.map.get(fileName);
  }

  public getFileNames(): string[] {
    return [...this.map.keys()];
  }
}
