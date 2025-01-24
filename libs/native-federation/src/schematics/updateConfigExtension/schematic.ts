import { Rule, Tree } from '@angular-devkit/schematics';
import { MfSchematicSchema } from '../init/schema';
import { renameConfigToCjs } from '../init/schematic';

export default function updateConfigExtension(
  options: MfSchematicSchema
): Rule {
  return async function (tree: Tree) {
    renameConfigToCjs(options, tree);
  };
}
