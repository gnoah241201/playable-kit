export interface PlayableConfig {
  gameTitle: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  syncLinks: boolean;
}

export type DeviceMode = 'responsive' | 'portrait' | 'landscape' | 'tablet';
export type FileType = 'standalone' | 'applovin';

export const DEFAULT_CONFIG: PlayableConfig = {
  gameTitle: 'Royal Cooking: Kitchen Madness',
  iosStoreUrl: 'https://apps.apple.com/us/app/royal-cooking-kitchen-madness/id1664415775',
  androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.matryoshka.royal.cooking.kitchen.madness',
  syncLinks: false,
};

export const ORIGINAL_IOS_URL = 'https://apps.apple.com/us/app/royal-cooking-kitchen-madness/id1664415775';
export const ORIGINAL_ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.matryoshka.royal.cooking.kitchen.madness';
