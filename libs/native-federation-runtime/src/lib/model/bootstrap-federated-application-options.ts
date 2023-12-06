export type AppType = 'shell' | 'microfrontend';

export type BootstrapFederatedApplicationOptions = {
  appType: AppType;
  enableNgZoneSharing?: boolean;
};
