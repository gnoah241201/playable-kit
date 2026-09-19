export interface PlayableConfig {
  gameTitle: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  syncLinks: boolean;
}

export type DeviceMode = 'responsive' | 'portrait' | 'landscape' | 'tablet';

export const EMPTY_CONFIG: PlayableConfig = {
  gameTitle: '',
  iosStoreUrl: '',
  androidStoreUrl: '',
  syncLinks: false,
};
