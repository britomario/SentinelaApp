import {useCallback, useEffect, useState} from 'react';
import {AppState, DeviceEventEmitter} from 'react-native';

import {
  SHIELD_STATUS_EVENT,
  type ShieldStatus,
  getShieldStatus,
  restoreShieldFromStorage,
} from '../services/shieldService';

const INITIAL_STATUS: ShieldStatus = {
  enabled: false,
  paused: true,
  vpnActive: false,
  profileId: 'nextdns-family',
  updatedAt: Date.now(),
};

export function useShieldStatus(): {
  shieldStatus: ShieldStatus;
  refreshShieldStatus: () => Promise<void>;
} {
  const [shieldStatus, setShieldStatus] = useState<ShieldStatus>(INITIAL_STATUS);

  const refreshShieldStatus = useCallback(async () => {
    const next = await getShieldStatus();
    setShieldStatus(next);
  }, []);

  useEffect(() => {
    restoreShieldFromStorage()
      .then(setShieldStatus)
      .catch(() => refreshShieldStatus().catch(() => undefined));
    const statusSub = DeviceEventEmitter.addListener(
      SHIELD_STATUS_EVENT,
      (status: ShieldStatus) => {
        setShieldStatus(status);
      },
    );
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshShieldStatus().catch(() => undefined);
      }
    });
    return () => {
      statusSub.remove();
      appStateSub.remove();
    };
  }, [refreshShieldStatus]);

  return {shieldStatus, refreshShieldStatus};
}
