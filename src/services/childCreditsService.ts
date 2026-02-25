/**
 * Apps de créditos da criança - persistência local + sync Supabase.
 * Sincroniza com Tela de Controle dos Pais.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from './supabaseClient';
import {getOrCreateDeviceId} from './deviceIdService';

const CREDITS_APPS_KEY = '@sentinela/child_credits_apps';
const creditsListeners = new Set<() => void>();

export type ChildCreditsApp = {
  packageName: string;
  displayName: string;
  iconUri?: string;
  dailyLimitMinutes?: number;
};

async function getLocalCreditsApps(): Promise<ChildCreditsApp[]> {
  try {
    const raw = await AsyncStorage.getItem(CREDITS_APPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChildCreditsApp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setLocalCreditsApps(apps: ChildCreditsApp[]): Promise<void> {
  await AsyncStorage.setItem(CREDITS_APPS_KEY, JSON.stringify(apps));
}

function notifyCreditsAppsChanged(): void {
  for (const listener of creditsListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors to avoid breaking writer flow.
    }
  }
}

export function subscribeCreditsApps(listener: () => void): () => void {
  creditsListeners.add(listener);
  return () => {
    creditsListeners.delete(listener);
  };
}

export async function getChildCreditsApps(): Promise<ChildCreditsApp[]> {
  const [local, supabase] = await Promise.all([
    getLocalCreditsApps(),
    fetchCreditsAppsFromSupabase(),
  ]);
  if (supabase.length > 0) {
    await setLocalCreditsApps(supabase);
    return supabase;
  }
  return local;
}

async function fetchCreditsAppsFromSupabase(): Promise<ChildCreditsApp[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const deviceId = await getOrCreateDeviceId();
    const {data, error} = await supabase
      .from('child_credits_apps')
      .select('package_name, display_name, icon_uri, daily_limit_minutes')
      .eq('device_id', deviceId)
      .order('created_at', {ascending: true});

    if (error) return [];
    return (data ?? []).map((r: {
      package_name: string;
      display_name: string;
      icon_uri?: string;
      daily_limit_minutes?: number;
    }) => ({
      packageName: r.package_name,
      displayName: r.display_name,
      iconUri: r.icon_uri ?? undefined,
      dailyLimitMinutes: r.daily_limit_minutes ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function addChildCreditsApp(app: ChildCreditsApp): Promise<void> {
  const local = await getLocalCreditsApps();
  if (local.some(a => a.packageName === app.packageName)) return;

  const next = [...local, { ...app, dailyLimitMinutes: app.dailyLimitMinutes ?? 0 }];
  await setLocalCreditsApps(next);
  await syncCreditsAppToSupabase(app, 'add');
  notifyCreditsAppsChanged();
}

export async function removeChildCreditsApp(packageName: string): Promise<void> {
  const local = await getLocalCreditsApps();
  const next = local.filter(a => a.packageName !== packageName);
  await setLocalCreditsApps(next);
  await syncCreditsAppToSupabase({ packageName, displayName: '' }, 'remove');
  notifyCreditsAppsChanged();
}

async function syncCreditsAppToSupabase(
  app: { packageName: string; displayName: string; iconUri?: string; dailyLimitMinutes?: number },
  action: 'add' | 'remove',
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const deviceId = await getOrCreateDeviceId();

    if (action === 'add') {
      const {error} = await supabase.from('child_credits_apps').upsert(
        {
          device_id: deviceId,
          package_name: app.packageName,
          display_name: app.displayName,
          icon_uri: app.iconUri ?? null,
          daily_limit_minutes: app.dailyLimitMinutes ?? 0,
        },
        { onConflict: 'device_id,package_name' },
      );
      if (error) throw error;
    } else {
      const {error} = await supabase
        .from('child_credits_apps')
        .delete()
        .eq('device_id', deviceId)
        .eq('package_name', app.packageName);
      if (error) throw error;
    }
  } catch (error) {
    throw new Error(
      `Falha ao sincronizar app de creditos: ${
        error instanceof Error ? error.message : 'erro desconhecido'
      }`,
    );
  }
}

export async function updateCreditsAppLimit(
  packageName: string,
  dailyLimitMinutes: number,
): Promise<void> {
  const local = await getLocalCreditsApps();
  const idx = local.findIndex(a => a.packageName === packageName);
  if (idx < 0) return;
  local[idx].dailyLimitMinutes = dailyLimitMinutes;
  await setLocalCreditsApps(local);
  notifyCreditsAppsChanged();

  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const deviceId = await getOrCreateDeviceId();
    const {error} = await supabase
      .from('child_credits_apps')
      .update({ daily_limit_minutes: dailyLimitMinutes })
      .eq('device_id', deviceId)
      .eq('package_name', packageName);
    if (error) throw error;
  } catch (error) {
    throw new Error(
      `Falha ao atualizar limite diario: ${
        error instanceof Error ? error.message : 'erro desconhecido'
      }`,
    );
  }
}
