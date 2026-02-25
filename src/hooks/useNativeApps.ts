import {useCallback, useEffect, useState} from 'react';
import {NativeModules, Platform} from 'react-native';

const {AppBlockModule} = NativeModules;

export type AppInfo = {
  packageName: string;
  label: string;
};

export function useNativeApps(): {
  apps: AppInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'android' && AppBlockModule?.getInstalledApps) {
        const raw = await AppBlockModule.getInstalledApps();
        const list: AppInfo[] = Array.isArray(raw)
          ? raw.map((r: {packageName?: string; label?: string}) => ({
              packageName: r.packageName ?? '',
              label: r.label ?? r.packageName ?? '',
            }))
          : [];
        list.sort((a, b) => a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}));
        setApps(list);
      } else {
        setApps([]);
        if (Platform.OS === 'ios') {
          setError('Lista de apps disponível em breve no iOS.');
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao carregar apps');
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {apps, loading, error, refresh};
}
