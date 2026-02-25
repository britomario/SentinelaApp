import React from 'react';
import {RouteProp, useRoute} from '@react-navigation/native';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import AppIcon from '../../components/apps/AppIcon';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

type UsageEntry = {
  packageName: string;
  label: string;
  minutes: number;
  iconUri?: string;
};

type UsageRoute = RouteProp<{UsageDetails: {apps: UsageEntry[]}}, 'UsageDetails'>;

function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) {
    return `${m} min`;
  }
  return `${h}h ${m}min`;
}

export default function UsageDetailsScreen(): React.JSX.Element {
  const route = useRoute<UsageRoute>();
  const apps = [...(route.params?.apps ?? [])].sort((a, b) => b.minutes - a.minutes);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Apps mais usados</Text>
      <Text style={styles.subtitle}>Ordenado por tempo de uso semanal</Text>

      <View style={styles.card}>
        {apps.length === 0 ? (
          <Text style={styles.empty}>Sem dados de uso ainda.</Text>
        ) : (
          apps.map((app, idx) => (
            <View key={`${app.packageName}-${idx}`} style={styles.row}>
              <AppIcon name={app.label} iconUri={app.iconUri} size={32} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {app.label}
                </Text>
                <Text style={styles.pkg} numberOfLines={1}>
                  {app.packageName}
                </Text>
              </View>
              <Text style={styles.time}>{formatMinutes(app.minutes)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  title: {fontSize: 24, fontWeight: '700', color: Colors.textPrimary},
  subtitle: {fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md},
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadows.low,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  info: {flex: 1, marginLeft: Spacing.sm},
  name: {fontSize: 15, fontWeight: '600', color: Colors.textPrimary},
  pkg: {fontSize: 12, color: Colors.textMuted, marginTop: 2},
  time: {fontSize: 13, fontWeight: '700', color: Colors.primary},
  empty: {textAlign: 'center', color: Colors.textSecondary, paddingVertical: Spacing.lg},
});
