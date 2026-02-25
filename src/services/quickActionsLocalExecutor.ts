import {NativeModules} from 'react-native';
import type {QuickActionType} from './quickActionsDispatchService';

const {AppBlockModule} = NativeModules as {
  AppBlockModule?: {
    setForceBlockNow?: (enabled: boolean) => Promise<boolean>;
    setBlockingEnabled?: (enabled: boolean) => Promise<boolean>;
    getBlockedApps?: () => Promise<string[]>;
    setBlockedApps?: (packages: string[]) => Promise<boolean>;
    addTemporaryUnlock?: (packageName: string, expiresAtMs: number) => Promise<boolean>;
    requestLiveScreenPermission?: () => Promise<boolean>;
  };
};

export async function executeQuickActionLocally(
  action: QuickActionType,
  options?: {packages?: string[]},
): Promise<boolean> {
  try {
    if (!AppBlockModule) {
      return false;
    }
    const packages = (options?.packages ?? []).filter(Boolean);
    switch (action) {
      case 'block_now':
        if (!AppBlockModule.setBlockedApps || !AppBlockModule.setBlockingEnabled) {
          return false;
        }
        if (packages.length === 0) {
          return false;
        }
        const existing = AppBlockModule.getBlockedApps ? await AppBlockModule.getBlockedApps() : [];
        const merged = new Set([...(existing ?? []), ...packages]);
        await AppBlockModule.setBlockedApps(Array.from(merged));
        await AppBlockModule.setBlockingEnabled(true);
        return true;
      case 'grant_time':
        if (!AppBlockModule.addTemporaryUnlock || packages.length === 0) {
          return false;
        }
        const expiresAt = Date.now() + 30 * 60 * 1000;
        await Promise.all(
          packages.map(pkg => AppBlockModule.addTemporaryUnlock?.(pkg, expiresAt)),
        );
        return true;
      case 'live_screen_request':
        if (!AppBlockModule.requestLiveScreenPermission) {
          return false;
        }
        return !!(await AppBlockModule.requestLiveScreenPermission());
      default:
        return false;
    }
  } catch {
    return false;
  }
}
