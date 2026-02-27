/**
 * Hook para apps de créditos da criança (dinâmico + sync).
 */

import {useCallback, useEffect, useState} from 'react';
import {NativeModules, Platform} from 'react-native';

import {toAppIconEntry, type AppIconEntry} from '../assets/appIconCatalog';
import {
  addChildCreditsApp,
  getChildCreditsApps,
  removeChildCreditsApp,
  subscribeCreditsApps,
} from '../services/childCreditsService';

const {AppBlockModule} = NativeModules;

export type CreditsAppEntry = AppIconEntry & { packageName: string; dailyLimitMinutes?: number };

export type InstalledAppEntry = { packageName: string; label: string; iconUri?: string };

async function fetchInstalledApps(): Promise<InstalledAppEntry[]> {
  if (Platform.OS !== 'android' || !AppBlockModule?.getInstalledApps) {
    return [];
  }
  const installed = await AppBlockModule.getInstalledApps();
  const list = Array.isArray(installed)
    ? installed.map((r: { packageName?: string; label?: string; iconUri?: string }) => ({
        packageName: r.packageName ?? '',
        label: r.label ?? r.packageName ?? '',
        iconUri: r.iconUri ?? undefined,
      }))
    : [];
  list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return list;
}

export function useChildCreditsApps(): {
  creditsApps: CreditsAppEntry[];
  installedApps: InstalledAppEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadInstalledApps: () => Promise<void>;
  addApp: (pkg: string, label: string, iconUri?: string) => Promise<void>;
  removeApp: (packageName: string) => Promise<void>;
} {
  const [creditsApps, setCreditsApps] = useState<CreditsAppEntry[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledAppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInstalledApps = useCallback(async () => {
    try {
      const list = await fetchInstalledApps();
      setInstalledApps(list);
    } catch {
      setInstalledApps([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const credits = await getChildCreditsApps();
      const entries: CreditsAppEntry[] = credits.map(c => {
        const entry = toAppIconEntry(c.packageName, c.displayName, c.iconUri);
        return {
          ...entry,
          id: c.packageName,
          packageName: c.packageName,
          dailyLimitMinutes: c.dailyLimitMinutes ?? 0,
        };
      });
      setCreditsApps(entries);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar apps');
      setCreditsApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshFull = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [credits, installed] = await Promise.all([
        getChildCreditsApps(),
        fetchInstalledApps(),
      ]);
      setInstalledApps(installed);

      const entries: CreditsAppEntry[] = credits.map(c => {
        const entry = toAppIconEntry(c.packageName, c.displayName, c.iconUri);
        return {
          ...entry,
          id: c.packageName,
          packageName: c.packageName,
          dailyLimitMinutes: c.dailyLimitMinutes ?? 0,
        };
      });
      setCreditsApps(entries);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar apps');
      setCreditsApps([]);
      setInstalledApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addApp = useCallback(async (packageName: string, label: string, iconUri?: string) => {
    await addChildCreditsApp({
      packageName,
      displayName: label,
      iconUri,
      dailyLimitMinutes: 0,
    });
    await refreshFull();
  }, [refreshFull]);

  const removeApp = useCallback(async (packageName: string) => {
    await removeChildCreditsApp(packageName);
    await refreshFull();
  }, [refreshFull]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeCreditsApps(() => {
      refresh().catch(() => undefined);
    });
    return unsubscribe;
  }, [refresh]);

  return {
    creditsApps,
    installedApps,
    loading,
    error,
    refresh,
    loadInstalledApps,
    addApp,
    removeApp,
  };
}
