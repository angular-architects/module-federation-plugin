// A remote must not touch shared libraries before the share scope is
// initialized, so all real work happens behind this dynamic import.
import('./bootstrap').catch((err) => console.error(err));
