import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter, NativeModules} from 'react-native';

import {getDnsProfile, type DnsProfile} from './dnsProfiles';
import {getManualDomainLists} from './manualDomainListService';

const {VpnModule} = NativeModules as {
  VpnModule?: {
    startVpn?: (pin: string) => Promise<boolean>;
    stopVpn?: (pin: string) => Promise<boolean>;
    setUpstreamDns?: (ip: string) => Promise<boolean>;
    setNextDnsDotHost?: (dotHost: string) => Promise<boolean>;
    isVpnActive?: () => Promise<boolean>;
    updateBlacklist?: (domains: string[]) => void;
  };
};

const SHIELD_STATUS_KEY = '@sentinela/shield_status';
const SHIELD_PROFILE_KEY = '@sentinela/shield_profile';
export const SHIELD_STATUS_EVENT = 'sentinela.shield_status_changed';
let shieldTransitionInFlight = false;

export type ShieldProfile = Pick<
  DnsProfile,
  'id' | 'name' | 'provider' | 'dotHost' | 'dohUrl' | 'fallbackDnsIp'
>;

export type ShieldStatus = {
  enabled: boolean;
  paused: boolean;
  vpnActive: boolean;
  profileId: string;
  updatedAt: number;
};

const DEFAULT_PROFILE = getDnsProfile('nextdns-family');

const DEFAULT_STATUS: ShieldStatus = {
  enabled: false,
  paused: true,
  vpnActive: false,
  profileId: DEFAULT_PROFILE.id,
  updatedAt: Date.now(),
};

export async function setShieldProfile(profile: ShieldProfile): Promise<void> {
  await AsyncStorage.setItem(SHIELD_PROFILE_KEY, JSON.stringify(profile));
}

export async function getShieldProfile(): Promise<ShieldProfile> {
  const raw = await AsyncStorage.getItem(SHIELD_PROFILE_KEY);
  if (!raw) {
    return DEFAULT_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw) as ShieldProfile;
    if (!parsed?.id || !parsed?.fallbackDnsIp) {
      return DEFAULT_PROFILE;
    }
    return parsed;
  } catch {
    return DEFAULT_PROFILE;
  }
}

async function readShieldStatusFromStorage(): Promise<ShieldStatus> {
  const raw = await AsyncStorage.getItem(SHIELD_STATUS_KEY);
  if (!raw) {
    return DEFAULT_STATUS;
  }
  try {
    const parsed = JSON.parse(raw) as ShieldStatus;
    return {
      enabled: Boolean(parsed.enabled),
      paused: !parsed.enabled,
      vpnActive: Boolean(parsed.vpnActive),
      profileId: parsed.profileId || DEFAULT_PROFILE.id,
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
  const nativeActive = await VpnModule?.isVpnActive?.().catch?.((error: unknown) => {
    console.error('[Shield] Failed reading native VPN status', error);
    return false;
  });
  const next: ShieldStatus = {
    ...previous,
    vpnActive: Boolean(nativeActive),
    enabled: previous.enabled && Boolean(nativeActive),
    paused: !(previous.enabled && Boolean(nativeActive)),
    updatedAt: Date.now(),
  };
  if (
    next.enabled !== previous.enabled ||
    next.vpnActive !== previous.vpnActive ||
    next.paused !== previous.paused
  ) {
    await saveShieldStatus(next);
  }
  return next;
}

export async function activateShield(pin = ''): Promise<ShieldStatus> {
  if (shieldTransitionInFlight) {
    throw new Error('shield_transition_in_progress');
  }
  shieldTransitionInFlight = true;
  try {
    const profile = await getShieldProfile();
    if (!VpnModule?.startVpn || !VpnModule?.isVpnActive) {
      const unsupported: ShieldStatus = {
        enabled: false,
        paused: true,
        vpnActive: false,
        profileId: profile.id,
        updatedAt: Date.now(),
      };
      await saveShieldStatus(unsupported);
      return unsupported;
    }

    try {
      await VpnModule?.setUpstreamDns?.(profile.fallbackDnsIp);
    } catch (error) {
      console.error('[Shield] Failed setting upstream DNS', error);
      throw new Error('shield_dns_setup_failed');
    }

    if (profile.provider === 'nextdns' && profile.dotHost) {
      try {
        await VpnModule?.setNextDnsDotHost?.(profile.dotHost);
      } catch (error) {
        // Non-blocking: VPN DNS sinkhole still works with upstream fallback IP.
        console.error('[Shield] Failed setting NextDNS profile host', error);
      }
    }

    try {
      const lists = await getManualDomainLists();
      if (lists.blacklist.length > 0) {
        VpnModule?.updateBlacklist?.(lists.blacklist);
      }
    } catch (error) {
      console.error('[Shield] Failed syncing blacklist before activation', error);
    }

    try {
      await VpnModule.startVpn(pin);
    } catch (error) {
      console.error('[Shield] Failed starting VPN module', error);
      throw new Error('shield_vpn_start_failed');
    }

    const nativeActive = await VpnModule.isVpnActive().catch((error: unknown) => {
      console.error('[Shield] Failed confirming VPN status', error);
      return false;
    });
    const next: ShieldStatus = {
      enabled: Boolean(nativeActive),
      paused: !nativeActive,
      vpnActive: Boolean(nativeActive),
      profileId: profile.id,
      updatedAt: Date.now(),
    };
    await saveShieldStatus(next);
    return next;
  } finally {
    shieldTransitionInFlight = false;
  }
}

export async function deactivateShield(pin = ''): Promise<ShieldStatus> {
  if (shieldTransitionInFlight) {
    throw new Error('shield_transition_in_progress');
  }
  shieldTransitionInFlight = true;
  try {
    await VpnModule?.stopVpn?.(pin).catch?.((error: unknown) => {
      console.error('[Shield] Failed stopping VPN module', error);
      throw new Error('shield_vpn_stop_failed');
    });
    const profile = await getShieldProfile();
    const next: ShieldStatus = {
      enabled: false,
      paused: true,
      vpnActive: false,
      profileId: profile.id,
      updatedAt: Date.now(),
    };
    await saveShieldStatus(next);
    return next;
  } finally {
    shieldTransitionInFlight = false;
  }
}

export async function toggleShield(nextEnabled: boolean, pin = ''): Promise<ShieldStatus> {
  if (nextEnabled) {
    return activateShield(pin);
  }
  return deactivateShield(pin);
}

export async function syncBlacklistToShield(): Promise<void> {
  const status = await getShieldStatus();
  if (!status.enabled || !status.vpnActive) {
    return;
  }
  const lists = await getManualDomainLists();
  VpnModule?.updateBlacklist?.(lists.blacklist);
}

export async function restoreShieldFromStorage(): Promise<ShieldStatus> {
  const previous = await readShieldStatusFromStorage();
  const current = await getShieldStatus();
  if (!previous.enabled || current.vpnActive) {
    return current;
  }
  try {
    return await activateShield();
  } catch (error) {
    console.error('[Shield] Failed restoring active shield state', error);
    return current;
  }
}
