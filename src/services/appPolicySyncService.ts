/**
 * Sincronização opcional da política de apps com Supabase.
 * Fallback: persistência local via AppBlockModule.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from './supabaseClient';

const DEVICE_ID_KEY = '@sentinela/device_id';

async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function syncAppPolicyToSupabase(
  blockedPackages: string[],
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const deviceId = await getOrCreateDeviceId();

    const {data: existing} = await supabase
      .from('child_app_policy')
      .select('package_name')
      .eq('device_id', deviceId);

    const existingSet = new Set(
      (existing ?? []).map((r: {package_name: string}) => r.package_name),
    );
    const toAdd = blockedPackages.filter(p => !existingSet.has(p));
    const toRemove = [...existingSet].filter(p => !blockedPackages.includes(p));

    for (const pkg of toAdd) {
      await supabase.from('child_app_policy').upsert(
        {
          device_id: deviceId,
          package_name: pkg,
          allowed: false,
          updated_at: new Date().toISOString(),
        },
        {onConflict: 'device_id,package_name'},
      );
    }

    for (const pkg of toRemove) {
      await supabase
        .from('child_app_policy')
        .delete()
        .eq('device_id', deviceId)
        .eq('package_name', pkg);
    }
  } catch {
    // Silently fail - local is source of truth
  }
}

export async function fetchAppPolicyFromSupabase(): Promise<Set<string> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const deviceId = await getOrCreateDeviceId();
    const {data, error} = await supabase
      .from('child_app_policy')
      .select('package_name')
      .eq('device_id', deviceId)
      .eq('allowed', false);

    if (error) return null;
    return new Set((data ?? []).map((r: {package_name: string}) => r.package_name));
  } catch {
    return null;
  }
}
