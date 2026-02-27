import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sentinela/restricted_mode';

/**
 * Whether the restricted mode is active (child cannot access settings without PIN).
 * Defaults to true on cold start for security.
 */
export async function isRestricted(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) {return true;}
    return raw !== 'false';
  } catch {
    return true;
  }
}

/**
 * Set restricted mode. Persists across app restarts.
 */
export async function setRestricted(restricted: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, restricted ? 'true' : 'false');
}
