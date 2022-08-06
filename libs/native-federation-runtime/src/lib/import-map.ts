export type Imports = Record<string, string>;

export type Scopes = Record<string, Imports>;

export type ImportMap = {
  imports: Imports,
  scopes: Scopes
};
