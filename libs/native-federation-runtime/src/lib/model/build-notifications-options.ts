export interface BuildNotificationOptions {
  enable: boolean;
  endpoint: string;
}

export const BUILD_NOTIFICATIONS_ENDPOINT =
  '/@angular-architects/native-federation:build-notifications';

export enum BuildNotificationType {
  COMPLETED = 'federation-rebuild-complete',
  ERROR = 'federation-rebuild-error',
  CANCELLED = 'federation-rebuild-cancelled',
}
