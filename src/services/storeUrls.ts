import {Linking, Platform} from 'react-native';

const ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.sentinelaapp';
const IOS_STORE = 'https://apps.apple.com/app/id0000000000';

export function getStoreUrl(): string {
  return Platform.OS === 'ios' ? IOS_STORE : ANDROID_STORE;
}

export async function openStore(): Promise<void> {
  const url = getStoreUrl();
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}
