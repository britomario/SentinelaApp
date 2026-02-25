/**
 * Hook para CRUD de tarefas (pais).
 */

import {useCallback, useEffect, useState} from 'react';
import {
  createChildTask,
  deleteChildTask,
  getChildTasks,
  updateChildTask,
  type ChildTask,
} from '../services/childTasksService';
import {getSupabaseClient} from '../services/supabaseClient';
import {getOrCreateDeviceId} from '../services/deviceIdService';

export function useChildTasks(): {
  tasks: ChildTask[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTask: (title: string, rewardCoins: number) => Promise<ChildTask | null>;
  updateTask: (id: string, title: string, rewardCoins: number) => Promise<boolean>;
  removeTask: (id: string) => Promise<boolean>;
} {
  const [tasks, setTasks] = useState<ChildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getChildTasks();
      setTasks(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar tarefas');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (title: string, rewardCoins: number) => {
    const created = await createChildTask(title, rewardCoins);
    if (created) await refresh();
    return created;
  }, [refresh]);

  const updateTask = useCallback(async (id: string, title: string, rewardCoins: number) => {
    const ok = await updateChildTask(id, title, rewardCoins);
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  const removeTask = useCallback(async (id: string) => {
    const ok = await deleteChildTask(id);
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const deviceId = await getOrCreateDeviceId();
      channel = supabase
        .channel(`child_tasks:${deviceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'child_tasks',
            filter: `device_id=eq.${deviceId}`,
          },
          () => {
            refresh().catch(() => undefined);
          },
        )
        .subscribe();
    };

    setupSubscription().catch(() => undefined);

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { tasks, loading, error, refresh, createTask, updateTask, removeTask };
}
