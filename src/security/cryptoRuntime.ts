/**
 * Crypto Runtime Adapter - Web Crypto compatibility for React Native / mobile.
 * Uses globalThis.crypto.subtle when available (browser, secure context).
 * When unavailable (e.g. RN Hermes), throws with controlled error.
 * Note: @peculiar/webcrypto uses Node 'crypto' which is not available in RN.
 */

import {captureHandledError} from '../services/observability/sentry';

const WEB_CRYPTO_UNAVAILABLE =
  'WebCrypto indisponivel. Ative um provider de crypto no runtime para usar E2EE.';

/**
 * Detects if the current runtime has a secure crypto context.
 * In production, prefer HTTPS or localhost; mobile RN is always "secure enough" for local keys.
 */
export function isSecureCryptoContext(): boolean {
  if (typeof globalThis === 'undefined') {
    return false;
  }
  const g = globalThis as {
    location?: { protocol?: string; hostname?: string };
    window?: { location?: { protocol?: string; hostname?: string } };
  };
  const loc = g.location ?? g.window?.location;
  if (!loc) {
    return true;
  }
  const protocol = loc.protocol ?? '';
  const hostname = loc.hostname ?? '';
  return (
    protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local')
  );
}

/**
 * Returns SubtleCrypto from globalThis.crypto when available.
 * Uses polyfill (react-native-webview-crypto) when native subtle is absent (e.g. RN Hermes).
 * Throws with controlled error and telemetry when crypto is unavailable.
 */
export function getSubtleCrypto(): SubtleCrypto {
  const crypto = (globalThis as {crypto?: Crypto}).crypto;
  const subtle = crypto?.subtle;
  if (subtle) {
    return subtle as SubtleCrypto;
  }
  captureHandledError(new Error(WEB_CRYPTO_UNAVAILABLE), 'crypto_subtle_unavailable');
  throw new Error(WEB_CRYPTO_UNAVAILABLE);
}

/**
 * Returns secure random bytes. Uses native getRandomValues when available,
 * otherwise falls back to polyfill (react-native-get-random-values).
 */
export function getRandomValues(buffer: Uint8Array): Uint8Array {
  const cryptoApi = (globalThis as {crypto?: Crypto}).crypto;
  if (cryptoApi?.getRandomValues) {
    return cryptoApi.getRandomValues(buffer);
  }
  captureHandledError(new Error('getRandomValues unavailable'), 'crypto_getrandomvalues');
  throw new Error('getRandomValues indisponivel. Instale react-native-get-random-values.');
}
