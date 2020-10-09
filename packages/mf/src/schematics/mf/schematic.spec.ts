import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { join } from 'path';

import { MfSchematicSchema } from './schema';

describe('mf schematic', () => {
  let appTree: Tree;
  const options: MfSchematicSchema = { name: 'test' };

  const testRunner = new SchematicTestRunner(
    '@angular-architects/mf',
    join(__dirname, '../../../collection.json')
  );

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should run successfully', async () => {
    await expect(
      testRunner.runSchematicAsync('mf', options, appTree).toPromise()
    ).resolves.not.toThrowError();
  });
});
