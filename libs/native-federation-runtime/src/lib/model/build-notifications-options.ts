export interface BuildNotificationOptions {
  enable: boolean;
  customEndpoint?: string;
}

export const BUILD_NOTIFICATIONS_ENDPOINT =
  '/@angular-architects/native-federation:build-notifications';

export enum BuildNotificationType {
  COMPLETED = 'federation-rebuild-complete',
  ERROR = 'federation-rebuild-error',
}
