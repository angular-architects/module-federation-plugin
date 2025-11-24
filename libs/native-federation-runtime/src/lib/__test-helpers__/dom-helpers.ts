/**
 * DOM test helpers for federation tests
 */

/**
 * Gets all importmap-shim scripts from document head
 */
export const getImportMapScripts = (): NodeListOf<HTMLScriptElement> => {
  return document.querySelectorAll('script[type="importmap-shim"]');
};

/**
 * Removes all importmap-shim scripts from document head
 */
export const clearImportMapScripts = (): void => {
  const scripts = getImportMapScripts();
  scripts.forEach((script) => script.remove());
};

/**
 * Gets the parsed content of the first importmap-shim script
 */
export const getImportMapContent = (): {
  imports: Record<string, string>;
  scopes: Record<string, Record<string, string>>;
} | null => {
  const scripts = getImportMapScripts();
  if (scripts.length === 0) {
    return null;
  }
  
  try {
    return JSON.parse(scripts[0].innerHTML);
  } catch {
    return null;
  }
};

/**
 * Asserts that an importmap script exists in the DOM
 */
export const assertImportMapExists = (): void => {
  const scripts = getImportMapScripts();
  if (scripts.length === 0) {
    throw new Error('Expected importmap-shim script to exist in document head');
  }
};

/**
 * Gets the count of importmap scripts in the document
 */
export const getImportMapScriptCount = (): number => {
  return getImportMapScripts().length;
};

/**
 * Clears all DOM side effects from federation initialization
 */
export const clearFederationDOMEffects = (): void => {
  clearImportMapScripts();
  // Add more cleanup here if federation adds other DOM elements
};

