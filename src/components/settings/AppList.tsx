/**
 * Lista nativa de apps com busca e toggles para permitir/bloquear.
 */

import React, {useMemo, useState} from 'react';
import {
  NativeModules,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AppIcon from '../apps/AppIcon';
import Skeleton from '../feedback/Skeleton';
import {useNativeApps} from '../../hooks/useNativeApps';
import {BorderRadius, Colors, Spacing} from '../../theme/colors';

const {AppBlockModule} = NativeModules as any;

type AppListProps = Readonly<{
  blockedApps: Set<string>;
  blockingEnabled: boolean;
  onToggleBlocking: (enabled: boolean) => void;
  onToggleApp: (packageName: string) => void;
}>;

export default function AppList({
  blockedApps,
  blockingEnabled,
  onToggleBlocking,
  onToggleApp,
}: AppListProps): React.JSX.Element {
  const {apps, loading, error, refresh} = useNativeApps();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.trim().toLowerCase();
    return apps.filter(
      a => a.label.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q),
    );
  }, [apps, search]);

  if (loading) {
    return (
      <View style={styles.section}>
        <Skeleton width="100%" height={48} style={{marginBottom: Spacing.md}} />
        <Skeleton width="100%" height={56} style={{marginBottom: Spacing.sm}} />
        <Skeleton width="90%" height={56} style={{marginBottom: Spacing.sm}} />
        <Skeleton width="95%" height={56} style={{marginBottom: Spacing.sm}} />
        <Skeleton width="85%" height={56} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.section}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
          <Text style={styles.refreshText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar apps..."
        placeholderTextColor={Colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.row}>
        <Text style={styles.label}>Bloquear apps</Text>
        <Switch
          value={blockingEnabled}
          onValueChange={onToggleBlocking}
          trackColor={{false: '#CBD5E1', true: Colors.mintLight}}
          thumbColor={blockingEnabled ? Colors.mint : '#64748B'}
        />
      </View>
      <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
        <Text style={styles.refreshText}>Atualizar lista</Text>
      </TouchableOpacity>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(app => {
          const isBlocked = blockedApps.has(app.packageName);
          return (
            <View key={app.packageName} style={styles.appRow}>
              <AppIcon name={app.label} size={40} style={styles.appIcon} />
              <View style={styles.appInfo}>
                <Text style={[styles.appLabel, !blockingEnabled && styles.textMuted]}>
                  {app.label}
                </Text>
              </View>
              <Switch
                value={isBlocked}
                onValueChange={() => onToggleApp(app.packageName)}
                disabled={!blockingEnabled}
                trackColor={{false: '#CBD5E1', true: Colors.alert}}
                thumbColor={isBlocked ? Colors.white : '#64748B'}
              />
            </View>
          );
        })}
      </ScrollView>
      {filtered.length === 0 && (
        <Text style={styles.emptyText}>
          {search.trim() ? 'Nenhum app encontrado.' : 'Nenhum app instalado.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {marginBottom: Spacing.lg},
  searchInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  label: {fontSize: 16, color: Colors.textPrimary, flex: 1, fontWeight: '600'},
  refreshBtn: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  refreshText: {color: Colors.primary, fontWeight: '600'},
  list: {maxHeight: 360},
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  appIcon: {marginRight: Spacing.md},
  appInfo: {flex: 1},
  appLabel: {fontSize: 15, fontWeight: '500', color: Colors.textPrimary},
  textMuted: {color: Colors.textMuted},
  errorText: {
    color: Colors.alert,
    marginBottom: Spacing.md,
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
