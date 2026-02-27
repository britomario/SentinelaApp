import {useCallback, useEffect, useState} from 'react';
import {AppState, DeviceEventEmitter} from 'react-native';

import {syncBlacklist} from '../services/blacklistSyncService';
import {
  SHIELD_STATUS_EVENT,
  syncBlacklistToShield,
  type ShieldStatus,
  getShieldStatus,
  restoreShieldFromStorage,
} from '../services/shieldService';

const HOURLY_SYNC_INTERVAL_MS = 60 * 60 * 1000;

const INITIAL_STATUS: ShieldStatus = {
  enabled: false,
  paused: true,
  vpnActive: false,
  profileId: 'local',
  updatedAt: Date.now(),
};

export function useShieldStatus(): {
  shieldStatus: ShieldStatus;
  refreshShieldStatus: () => Promise<void>;
} {
  const [shieldStatus, setShieldStatus] = useState<ShieldStatus>(INITIAL_STATUS);
  const [appState, setAppState] = useState<string>(() => AppState.currentState);

  const refreshShieldStatus = useCallback(async () => {
    const next = await getShieldStatus();
    setShieldStatus(next);
  }, []);

  useEffect(() => {
    restoreShieldFromStorage()
      .then(setShieldStatus)
      .catch(() => refreshShieldStatus().catch(() => undefined));
    syncBlacklist().catch(() => undefined);
    const statusSub = DeviceEventEmitter.addListener(
      SHIELD_STATUS_EVENT,
      (status: ShieldStatus) => {
        setShieldStatus(status);
      },
    );
    const appStateSub = AppState.addEventListener('change', state => {
      setAppState(state);
      if (state === 'active') {
        refreshShieldStatus().catch(() => undefined);
      }
    });
    return () => {
      statusSub.remove();
      appStateSub.remove();
    };
  }, [refreshShieldStatus]);

  useEffect(() => {
    if (!shieldStatus.enabled || appState !== 'active') {
      return;
    }
    const runHourlySync = () => {
      syncBlacklist().catch(() => undefined).then(() => {
        syncBlacklistToShield().catch(() => undefined);
      });
    };
    const id = setInterval(runHourlySync, HOURLY_SYNC_INTERVAL_MS);
    runHourlySync();
    return () => clearInterval(id);
  }, [shieldStatus.enabled, appState]);

  return {shieldStatus, refreshShieldStatus};
}
