// Nothing may touch a shared library before the share scope is initialized,
// so all real work sits behind this dynamic import.
import('./bootstrap').catch((err) => console.error(err));
