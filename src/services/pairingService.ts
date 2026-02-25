import AsyncStorage from '@react-native-async-storage/async-storage';

import {getRandomValues} from '../security/cryptoRuntime';

export type PairingPayload = {
  deepLinkUrl: string;
  appDeepLink: string;
  pairToken: string;
  expiresAt: number;
  parentPublicKeyB64: string;
};

const CHILD_PAIRING_KEY = 'sentinela.pairing.child.config';
const PARENT_PAIRING_TOKEN_KEY = 'sentinela.pairing.parent.lastToken';
export const PAIR_TOKEN_TTL_MS = 10 * 60 * 1000;
const LANDING_URL = 'https://sentinela.app/download';
const ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.sentinelaapp';
const IOS_STORE = 'https://apps.apple.com/app/id0000000000';

export function createPairingPayload(parentPublicKeyB64: string): PairingPayload {
  const pairToken = createSecureToken();
  const expiresAt = Date.now() + PAIR_TOKEN_TTL_MS;
  const params = `pairToken=${encodeURIComponent(pairToken)}&parentKey=${encodeURIComponent(parentPublicKeyB64)}&expiresAt=${expiresAt}`;
  const appDeepLink = `sentinela://pair?${params}`;
  const deepLinkUrl = `${LANDING_URL}?${params}&androidStore=${encodeURIComponent(ANDROID_STORE)}&iosStore=${encodeURIComponent(IOS_STORE)}`;
  return {
    pairToken,
    expiresAt,
    parentPublicKeyB64,
    deepLinkUrl,
    appDeepLink,
  };
}

export async function storeParentPairingToken(pairToken: string): Promise<void> {
  await AsyncStorage.setItem(PARENT_PAIRING_TOKEN_KEY, pairToken);
}

export function parsePairingUrl(url: string): {
  pairToken: string;
  parentPublicKeyB64: string;
  expiresAt?: number;
} | null {
  const pairToken = getQueryParam(url, 'pairToken');
  const parentPublicKeyB64 = getQueryParam(url, 'parentKey');
  if (!pairToken || !parentPublicKeyB64) {
    return null;
  }
  const expiresAtRaw = getQueryParam(url, 'expiresAt');
  const expiresAt = expiresAtRaw ? parseInt(expiresAtRaw, 10) : undefined;
  return {pairToken, parentPublicKeyB64, expiresAt};
}

export async function storeChildPairingConfig(input: {
  pairToken: string;
  parentPublicKeyB64: string;
  expiresAt?: number;
}): Promise<void> {
  const expiresAt = input.expiresAt ?? Date.now() + PAIR_TOKEN_TTL_MS;
  if (expiresAt <= Date.now()) {
    return;
  }
  await AsyncStorage.setItem(
    CHILD_PAIRING_KEY,
    JSON.stringify({
      pairToken: input.pairToken,
      parentPublicKeyB64: input.parentPublicKeyB64,
      expiresAt,
    }),
  );
}

export async function getChildPairingConfig(): Promise<{
  pairToken: string;
  parentPublicKeyB64: string;
} | null> {
  const raw = await AsyncStorage.getItem(CHILD_PAIRING_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      pairToken: string;
      parentPublicKeyB64: string;
      expiresAt?: number;
    };
    if (!parsed.pairToken || !parsed.parentPublicKeyB64) {
      return null;
    }
    if (parsed.expiresAt && parsed.expiresAt <= Date.now()) {
      await AsyncStorage.removeItem(CHILD_PAIRING_KEY);
      return null;
    }
    return {
      pairToken: parsed.pairToken,
      parentPublicKeyB64: parsed.parentPublicKeyB64,
    };
  } catch {
    return null;
  }
}

function createSecureToken(): string {
  const bytes = new Uint8Array(24);
  getRandomValues(bytes);

  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCodePoint(byte);
  });
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function getQueryParam(url: string, key: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get(key);
  } catch {
    return null;
  }
}
