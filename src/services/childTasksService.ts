/**
 * CRUD de tarefas para pais - Supabase child_tasks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from './supabaseClient';
import {getOrCreateDeviceId} from './deviceIdService';

const TASKS_DONE_KEY = '@sentinela/child_tasks_done';
const TASKS_KEY = '@sentinela/child_tasks';

export type ChildTask = {
  id: string;
  title: string;
  rewardCoins: number;
  createdAt: string;
};

async function getLocalTasks(): Promise<ChildTask[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ChildTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setLocalTasks(tasks: ChildTask[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function getChildTasks(): Promise<ChildTask[]> {
  const supabase = getSupabaseClient();
  const local = await getLocalTasks();
  if (!supabase) {
    return local;
  }

  try {
    const deviceId = await getOrCreateDeviceId();
    const {data, error} = await supabase
      .from('child_tasks')
      .select('id, title, reward_coins, created_at')
      .eq('device_id', deviceId)
      .order('created_at', {ascending: false});

    if (error) {
      return local;
    }
    const mapped = (data ?? []).map((r: {
      id: string;
      title: string;
      reward_coins: number;
      created_at: string;
    }) => ({
      id: r.id,
      title: r.title,
      rewardCoins: r.reward_coins,
      createdAt: r.created_at,
    }));
    if (mapped.length > 0) {
      await setLocalTasks(mapped);
      return mapped;
    }
    return local;
  } catch {
    return local;
  }
}

export async function createChildTask(
  title: string,
  rewardCoins: number,
): Promise<ChildTask | null> {
  const safeTitle = title.trim();
  const safeReward = Number.isFinite(rewardCoins) ? Math.max(0, Math.trunc(rewardCoins)) : 0;
  if (!safeTitle) {
    return null;
  }

  const localTask: ChildTask = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: safeTitle,
    rewardCoins: safeReward,
    createdAt: new Date().toISOString(),
  };

  const local = await getLocalTasks();
  await setLocalTasks([localTask, ...local]);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return localTask;
  }

  try {
    const deviceId = await getOrCreateDeviceId();
    const {data, error} = await supabase
      .from('child_tasks')
      .insert({
        device_id: deviceId,
        title: safeTitle,
        reward_coins: safeReward,
        updated_at: new Date().toISOString(),
      })
      .select('id, title, reward_coins, created_at')
      .single();

    if (error) {
      console.warn('[childTasks] createChildTask failed', error.message);
      return localTask;
    }

    const syncedTask: ChildTask = {
      id: data.id,
      title: data.title,
      rewardCoins: data.reward_coins,
      createdAt: data.created_at,
    };
    const nextLocal = (await getLocalTasks()).map(t => (t.id === localTask.id ? syncedTask : t));
    await setLocalTasks(nextLocal);
    return syncedTask;
  } catch (error) {
    console.warn(
      '[childTasks] createChildTask exception',
      error instanceof Error ? error.message : String(error),
    );
    return localTask;
  }
}

export async function updateChildTask(
  id: string,
  title: string,
  rewardCoins: number,
): Promise<boolean> {
  const safeTitle = title.trim();
  const safeReward = Number.isFinite(rewardCoins) ? Math.max(0, Math.trunc(rewardCoins)) : 0;
  if (!safeTitle) {
    return false;
  }

  const local = await getLocalTasks();
  const localUpdated = local.map(task =>
    task.id === id ? {...task, title: safeTitle, rewardCoins: safeReward} : task,
  );
  await setLocalTasks(localUpdated);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return true;
  }

  try {
    const {error} = await supabase
      .from('child_tasks')
      .update({
        title: safeTitle,
        reward_coins: safeReward,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return !error;
  } catch {
    return true;
  }
}

export async function deleteChildTask(id: string): Promise<boolean> {
  const local = await getLocalTasks();
  await setLocalTasks(local.filter(task => task.id !== id));

  const supabase = getSupabaseClient();
  if (!supabase) {
    return true;
  }

  try {
    const {error} = await supabase.from('child_tasks').delete().eq('id', id);
    return !error;
  } catch {
    return true;
  }
}

export async function getTasksDoneIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_DONE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}
