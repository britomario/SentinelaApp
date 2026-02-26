/**
 * Hook para apps de créditos visíveis aos pais (sync com child_credits_apps).
 * Inclui assinatura em tempo real para atualização instantânea ao adicionar app na tela da criança.
 */

import {useCallback, useEffect, useState} from 'react';

import {
  getChildCreditsApps,
  subscribeCreditsApps,
  updateCreditsAppLimit,
  type ChildCreditsApp,
} from '../services/childCreditsService';
import {getSupabaseClient} from '../services/supabaseClient';
import {getOrCreateDeviceId} from '../services/deviceIdService';

export function useParentCreditsApps(): {
  apps: ChildCreditsApp[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateLimit: (packageName: string, minutes: number) => Promise<void>;
} {
  const [apps, setApps] = useState<ChildCreditsApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getChildCreditsApps();
      setApps(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar apps');
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLimit = useCallback(async (packageName: string, minutes: number) => {
    await updateCreditsAppLimit(packageName, minutes);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeCreditsApps(() => {
      refresh().catch(() => undefined);
    });
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {return;}

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const deviceId = await getOrCreateDeviceId();
      channel = supabase
        .channel(`child_credits_apps:${deviceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'child_credits_apps',
            filter: `device_id=eq.${deviceId}`,
          },
          () => {
            refresh();
          },
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refresh]);

  return { apps, loading, error, refresh, updateLimit };
}
