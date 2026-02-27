import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter, NativeModules} from 'react-native';

import {getMergedBlacklist, syncBlacklist} from './blacklistSyncService';
import {
  getManualDomainLists,
  getEffectiveKeywords,
} from './manualDomainListService';

const {BlockingModule, AppBlockModule} = NativeModules as {
  BlockingModule?: {
    setUrlBlockingEnabled?: (enabled: boolean) => Promise<void>;
    isUrlBlockingEnabled?: () => Promise<boolean>;
    setBlacklist?: (domains: string[]) => Promise<void>;
    setWhitelist?: (domains: string[]) => Promise<void>;
    setKeywords?: (keywords: string[]) => Promise<void>;
  };
  AppBlockModule?: {
    setBlockingEnabled?: (enabled: boolean) => Promise<void>;
  };
};

const SHIELD_STATUS_KEY = '@sentinela/shield_status';
export const SHIELD_STATUS_EVENT = 'sentinela.shield_status_changed';
let shieldTransitionInFlight = false;

export type ShieldStatus = {
  enabled: boolean;
  paused: boolean;
  vpnActive: boolean;
  profileId: string;
  updatedAt: number;
};

const DEFAULT_STATUS: ShieldStatus = {
  enabled: false,
  paused: true,
  vpnActive: false,
  profileId: 'local',
  updatedAt: Date.now(),
};

async function readShieldStatusFromStorage(): Promise<ShieldStatus> {
  const raw = await AsyncStorage.getItem(SHIELD_STATUS_KEY);
  if (!raw) {return DEFAULT_STATUS;}
  try {
    const parsed = JSON.parse(raw) as ShieldStatus;
    return {
      enabled: Boolean(parsed.enabled),
      paused: !parsed.enabled,
      vpnActive: Boolean(parsed.enabled),
      profileId: parsed.profileId || 'local',
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return DEFAULT_STATUS;
  }
}

async function saveShieldStatus(status: ShieldStatus): Promise<void> {
  await AsyncStorage.setItem(SHIELD_STATUS_KEY, JSON.stringify(status));
  DeviceEventEmitter.emit(SHIELD_STATUS_EVENT, status);
}

export async function getShieldStatus(): Promise<ShieldStatus> {
  const previous = await readShieldStatusFromStorage();
  const nativeEnabled = await BlockingModule?.isUrlBlockingEnabled?.().catch(
    () => false,
  );
  const next: ShieldStatus = {
    ...previous,
    enabled: Boolean(nativeEnabled),
    paused: !nativeEnabled,
    vpnActive: Boolean(nativeEnabled),
    updatedAt: Date.now(),
  };
  if (next.enabled !== previous.enabled || next.paused !== previous.paused) {
    await saveShieldStatus(next);
  }
  return next;
}

const SYNC_RETRY_ATTEMPTS = 3;
const SYNC_RETRY_DELAY_MS = 500;

async function syncListsToBlocking(): Promise<void> {
  const attempt = async (): Promise<void> => {
    const [mergedBlacklist, lists] = await Promise.all([
      getMergedBlacklist(),
      getManualDomainLists(),
    ]);
    const keywords = getEffectiveKeywords(lists.keywords);
    if (!BlockingModule?.setBlacklist || !BlockingModule?.setWhitelist || !BlockingModule?.setKeywords) {
      throw new Error('BlockingModule not available');
    }
    await BlockingModule.setBlacklist(mergedBlacklist);
    await BlockingModule.setWhitelist(lists.whitelist);
    await BlockingModule.setKeywords(keywords);
  };

  let lastError: unknown;
  for (let i = 0; i < SYNC_RETRY_ATTEMPTS; i++) {
    try {
      await attempt();
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[Shield] syncListsToBlocking attempt ${i + 1}/${SYNC_RETRY_ATTEMPTS} failed:`, error);
      if (i < SYNC_RETRY_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, SYNC_RETRY_DELAY_MS));
      }
    }
  }
  console.error('[Shield] Failed syncing lists to BlockingModule after retries', lastError);
  throw lastError;
}

export async function activateShield(_pin = ''): Promise<ShieldStatus> {
  if (shieldTransitionInFlight) {
    throw new Error('shield_transition_in_progress');
  }
  shieldTransitionInFlight = true;
  try {
    if (!BlockingModule?.setUrlBlockingEnabled) {
      const unsupported: ShieldStatus = {
        ...DEFAULT_STATUS,
        updatedAt: Date.now(),
      };
      await saveShieldStatus(unsupported);
      return unsupported;
    }
    await syncBlacklist().catch(() => undefined);
    await syncListsToBlocking();
    await BlockingModule.setUrlBlockingEnabled(true);
    await AppBlockModule?.setBlockingEnabled?.(true);
    const next = await getShieldStatus();
    await saveShieldStatus(next);
    return next;
  } finally {
    shieldTransitionInFlight = false;
  }
}

export async function deactivateShield(_pin = ''): Promise<ShieldStatus> {
  if (shieldTransitionInFlight) {
    throw new Error('shield_transition_in_progress');
  }
  shieldTransitionInFlight = true;
  try {
    await BlockingModule?.setUrlBlockingEnabled?.(false);
    await AppBlockModule?.setBlockingEnabled?.(false);
    const next = await getShieldStatus();
    await saveShieldStatus(next);
    return next;
  } finally {
    shieldTransitionInFlight = false;
  }
}

export async function toggleShield(
  nextEnabled: boolean,
  pin = '',
): Promise<ShieldStatus> {
  if (nextEnabled) {return activateShield(pin);}
  return deactivateShield(pin);
}

export function getShieldErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === 'shield_pin_required') {
    return 'Digite o PIN correto para alterar o Escudo.';
  }
  if (msg === 'shield_transition_in_progress') {
    return 'Aguarde, operação em andamento.';
  }
  return 'Não foi possível alterar o Escudo. Tente novamente.';
}

export async function syncBlacklistToShield(): Promise<void> {
  const status = await getShieldStatus();
  if (!status.enabled) {return;}
  await syncListsToBlocking();
}

export async function restoreShieldFromStorage(): Promise<ShieldStatus> {
  const previous = await readShieldStatusFromStorage();
  const current = await getShieldStatus();
  if (!previous.enabled || current.enabled) {return current;}
  try {
    return await activateShield();
  } catch (error) {
    console.error('[Shield] Failed restoring active shield state', error);
    return current;
  }
}
