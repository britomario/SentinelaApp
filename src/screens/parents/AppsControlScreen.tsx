import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Skeleton from '../../components/feedback/Skeleton';
import AppIcon from '../../components/apps/AppIcon';
import GuidedTourOverlay from '../../components/tour/GuidedTourOverlay';
import {useToast} from '../../components/feedback/ToastProvider';
import {hasSeenTour, markTourSeen} from '../../services/onboardingState';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

const APPS_BY_CATEGORY = [
  {
    category: 'Jogos',
    apps: [
      {id: '1', name: 'Roblox', limit: 60},
      {id: '2', name: 'Minecraft', limit: 45},
    ],
  },
  {
    category: 'Social',
    apps: [
      {id: '3', name: 'TikTok', limit: 30},
      {id: '4', name: 'Instagram', limit: 45},
    ],
  },
];

const APPS_TOUR = [
  {
    title: 'Limites por categoria',
    description: 'Defina regras de tempo para jogos e redes sociais rapidamente.',
  },
  {
    title: 'Contatos permitidos',
    description: 'Garanta comunicacao apenas com contatos da familia.',
  },
];

export default function AppsControlScreen(): React.JSX.Element {
  const {showToast} = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [whitelistOnly, setWhitelistOnly] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    hasSeenTour('apps-control').then(seen => {
      if (!seen) {
        setTourVisible(true);
      }
    });
  }, []);

  const closeTour = () => {
    markTourSeen('apps-control').catch(() => undefined);
    setTourVisible(false);
    setTourStep(0);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <GuidedTourOverlay
        visible={tourVisible}
        steps={APPS_TOUR}
        stepIndex={tourStep}
        onClose={closeTour}
        onNext={() => {
          if (tourStep >= APPS_TOUR.length - 1) {
            closeTour();
            return;
          }
          setTourStep(prev => prev + 1);
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Controle de Apps</Text>
          <TouchableOpacity onPress={() => setTourVisible(true)}>
            <Text style={styles.help}>Ajuda</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Limites por app</Text>
        {isLoading ? (
          <View style={styles.card}>
            <Skeleton width="55%" />
            <Skeleton width="100%" style={{marginTop: 8}} />
            <Skeleton width="82%" style={{marginTop: 8}} />
          </View>
        ) : (
          APPS_BY_CATEGORY.map(cat => (
            <View key={cat.category} style={styles.section}>
              <Text style={styles.categoryLabel}>{cat.category}</Text>
              <View style={styles.card}>
                {cat.apps.map(app => (
                  <TouchableOpacity
                    key={app.id}
                    style={styles.appRow}
                    onPress={() =>
                      showToast({
                        kind: 'info',
                        title: `${app.name}: ${app.limit} min/dia`,
                        message: 'Edicao detalhada em breve.',
                      })
                    }>
                    <AppIcon name={app.name} size={24} style={{marginRight: Spacing.sm}} />
                    <View style={{flex: 1}}>
                      <Text style={styles.appName}>{app.name}</Text>
                      <Text style={styles.appLimit}>{app.limit} min/dia</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navegacao segura</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Somente whitelist</Text>
              <Switch
                value={whitelistOnly}
                onValueChange={(v: boolean) => {
                  setWhitelistOnly(v);
                  showToast({
                    kind: 'success',
                    title: v ? 'Whitelist ativada' : 'Whitelist desativada',
                  });
                }}
                trackColor={{false: '#CBD5E1', true: Colors.mintLight}}
                thumbColor={whitelistOnly ? Colors.mint : '#64748B'}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  scrollContent: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title: {fontSize: 24, fontWeight: '700', color: Colors.textPrimary},
  help: {color: Colors.primary, fontWeight: '700'},
  section: {marginTop: Spacing.md},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.md},
  categoryLabel: {fontSize: 14, color: Colors.textSecondary, marginBottom: 8, marginLeft: 4},
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadows.low,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  appIconWrapper: {marginRight: Spacing.sm},
  appName: {fontSize: 15, fontWeight: '600', color: Colors.textPrimary},
  appLimit: {fontSize: 13, color: Colors.textSecondary, marginTop: 2},
  toggleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  toggleLabel: {fontSize: 15, color: Colors.textPrimary, fontWeight: '600'},
});
