/**
 * This script stops the local registry for e2e testing purposes.
 * It is meant to be called in jest's globalTeardown.
 */

export default async () => {
  if (global.stopLocalRegistry) {
    // Awaited so jest does not exit while verdaccio is still shutting down,
    // which would leave it orphaned and holding the port.
    await global.stopLocalRegistry();
  }
};
