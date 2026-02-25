type EnvKey =
  | 'SUPABASE_URL'
  | 'SUPABASE_ANON_KEY'
  | 'SENTRY_DSN'
  | 'REVENUECAT_ANDROID_API_KEY'
  | 'REVENUECAT_IOS_API_KEY'
  | 'ONESIGNAL_APP_ID'
  | 'SYNC_API_BASE_URL'
  | 'MAPS_PROVIDER'
  | 'MAPS_API_KEY'
  | 'REALTIME_SOCKET_URL'
  | 'DNS_POLICY_API_BASE_URL'
  | 'DNS_VALIDATION_BLOCKED_DOMAIN'
  | 'DNS_PROVIDER_DEFAULT'
  | 'FEATURE_REALTIME_LOCATION'
  | 'FEATURE_DOH_ENGINE'
  | 'FEATURE_CHILD_ANTITAMPER';

function getEnvValue(key: EnvKey): string | undefined {
  try {
    const NativeConfig = require('react-native-config/codegen/NativeConfigModule').default;
    if (!NativeConfig || typeof NativeConfig.getConfig !== 'function') {
      return undefined;
    }
    const result = NativeConfig.getConfig();
    const config = result?.config;
    if (!config || typeof config !== 'object') {
      return undefined;
    }
    const fromConfig = config[key];
    if (typeof fromConfig === 'string' && fromConfig.trim()) {
      return fromConfig.trim();
    }
  } catch {
    // react-native-config não vinculado ou .env vazio
  }
  const fromProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}})
    .process?.env?.[key];
  return typeof fromProcess === 'string' ? fromProcess.trim() : undefined;
}

export function getEnv(key: EnvKey): string | null {
  const value = getEnvValue(key);
  return value ?? null;
}

export function getRequiredEnv(key: EnvKey): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getFeatureFlag(
  key:
    | 'FEATURE_REALTIME_LOCATION'
    | 'FEATURE_DOH_ENGINE'
    | 'FEATURE_CHILD_ANTITAMPER',
): boolean {
  const value = getEnv(key);
  if (!value) {
    return false;
  }
  return value === '1' || value.toLowerCase() === 'true';
}
