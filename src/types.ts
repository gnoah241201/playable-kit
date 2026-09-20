import { CompressMode } from './kit/project';

export type { CompressMode };

export interface PlayableConfig {
  gameTitle: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  syncLinks: boolean;
  disableAnalytics: boolean;
  compress: CompressMode;
}

export type DeviceMode = 'responsive' | 'portrait' | 'landscape' | 'tablet';

export const EMPTY_CONFIG: PlayableConfig = {
  gameTitle: '',
  iosStoreUrl: '',
  androidStoreUrl: '',
  syncLinks: false,
  disableAnalytics: false,
  compress: 'none',
};
