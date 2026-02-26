import React, {useEffect, useState} from 'react';
import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';

import Skeleton from '../../components/feedback/Skeleton';
import AppIcon from '../../components/apps/AppIcon';
import GuidedTourOverlay from '../../components/tour/GuidedTourOverlay';
import type {TourAnchor} from '../../components/tour/GuidedTourOverlay';
import {useToast} from '../../components/feedback/ToastProvider';
import {hasSeenTour, markTourSeen} from '../../services/onboardingState';
import {useParentCreditsApps} from '../../hooks/useParentCreditsApps';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

const APPS_TOUR = [
  {
    anchorKey: 'limits',
    title: 'Limites por categoria',
    description: 'Defina regras de tempo para jogos e redes sociais rapidamente.',
  },
  {
    anchorKey: 'whitelist',
    title: 'Contatos permitidos',
    description: 'Garanta comunicacao apenas com contatos da familia.',
  },
];

export default function AppsControlScreen(): React.JSX.Element {
  const {showToast} = useToast();
  const {apps: creditsApps, loading: creditsLoading, refresh, updateLimit} = useParentCreditsApps();
  const [whitelistOnly, setWhitelistOnly] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourAnchors, setTourAnchors] = useState<Record<string, TourAnchor>>({});
  const [editApp, setEditApp] = useState<{packageName: string; displayName: string; dailyLimitMinutes?: number} | null>(null);
  const [minutesInput, setMinutesInput] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const limitsRef = React.useRef<View>(null);
  const whitelistRef = React.useRef<View>(null);

  useEffect(() => {
    hasSeenTour('apps-control').then(seen => {
      if (!seen) {
        setTourVisible(true);
      }
    });
  }, []);

  const measureTourAnchors = () => {
    const refs: Array<{key: string; ref: React.RefObject<View>}> = [
      {key: 'limits', ref: limitsRef},
      {key: 'whitelist', ref: whitelistRef},
    ];
    refs.forEach(item => {
      item.ref.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          return;
        }
        setTourAnchors(prev => ({
          ...prev,
          [item.key]: {x, y, width, height},
        }));
      });
    });
  };

  useEffect(() => {
    if (!tourVisible) {
      return;
    }
    const timer = setTimeout(measureTourAnchors, 120);
    return () => clearTimeout(timer);
  }, [tourVisible, tourStep]);

  useFocusEffect(
    React.useCallback(() => {
      refresh().catch(() => undefined);
      return () => undefined;
    }, [refresh]),
  );

  const closeTour = () => {
    markTourSeen('apps-control').catch(() => undefined);
    setTourVisible(false);
    setTourStep(0);
  };

  const handleAppPress = (app: { packageName: string; displayName: string; dailyLimitMinutes?: number }) => {
    setEditApp(app);
    setMinutesInput(String(app.dailyLimitMinutes ?? 0));
  };

  const saveLimit = async () => {
    if (!editApp) {
      return;
    }
    const minutes = Math.max(0, parseInt(minutesInput, 10) || 0);
    setSavingLimit(true);
    try {
      await updateLimit(editApp.packageName, minutes);
      showToast({
        kind: 'success',
        title: 'Limite atualizado',
        message: `${editApp.displayName}: ${minutes} min/dia`,
      });
      setEditApp(null);
    } catch {
      showToast({
        kind: 'error',
        title: 'Falha ao atualizar limite',
      });
    } finally {
      setSavingLimit(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <GuidedTourOverlay
        visible={tourVisible}
        steps={APPS_TOUR}
        stepIndex={tourStep}
        anchor={tourAnchors[APPS_TOUR[tourStep]?.anchorKey]}
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
          <TouchableOpacity
            onPress={() => {
              setTourStep(0);
              setTourVisible(true);
            }}>
            <Text style={styles.help}>Ajuda</Text>
          </TouchableOpacity>
        </View>

        <View ref={limitsRef}>
          <Text style={styles.sectionTitle}>Limites por app</Text>
          <Text style={styles.sectionDesc}>
            Apps adicionados pela criança na tela de créditos aparecem aqui.
          </Text>
        </View>
        {creditsLoading ? (
          <View style={styles.card}>
            <Skeleton width="55%" />
            <Skeleton width="100%" style={styles.skeletonSpacer8} />
            <Skeleton width="82%" style={styles.skeletonSpacer8} />
          </View>
        ) : creditsApps.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nenhum app adicionado ainda. Peça à criança para adicionar apps na tela "Modo Criança".
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {creditsApps.map(app => (
              <TouchableOpacity
                key={app.packageName}
                style={styles.appRow}
                onPress={() => handleAppPress(app)}>
                <AppIcon
                  name={app.displayName}
                  size={24}
                  iconUri={app.iconUri}
                  style={styles.appIconWrapper}
                />
                <View style={styles.appRowContent}>
                  <Text style={styles.appName}>{app.displayName}</Text>
                  <Text style={styles.appLimit}>{app.dailyLimitMinutes ?? 60} min/dia</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.section} ref={whitelistRef}>
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

      <Modal visible={!!editApp} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar limite diário</Text>
            <Text style={styles.modalSubtitle}>{editApp?.displayName}</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={minutesInput}
              onChangeText={setMinutesInput}
              placeholder="Minutos por dia"
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setEditApp(null)}
                disabled={savingLimit}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={saveLimit}
                disabled={savingLimit}>
                <Text style={styles.modalSaveText}>
                  {savingLimit ? 'Salvando...' : 'Salvar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  scrollContent: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title: {fontSize: 26, fontWeight: '800', color: Colors.textPrimary},
  help: {color: Colors.primary, fontWeight: '700'},
  section: {marginTop: Spacing.md},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.md},
  sectionDesc: {fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md},
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.low,
  },
  emptyText: {fontSize: 15, color: Colors.textSecondary, textAlign: 'center'},
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F8FAFF',
    marginBottom: Spacing.sm,
  },
  appIconWrapper: {marginRight: Spacing.sm},
  appRowContent: {flex: 1},
  skeletonSpacer8: {marginTop: 8},
  appName: {fontSize: 15, fontWeight: '600', color: Colors.textPrimary},
  appLimit: {fontSize: 13, color: Colors.textSecondary, marginTop: 2},
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  toggleLabel: {fontSize: 15, color: Colors.textPrimary, fontWeight: '600'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.low,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: Colors.border,
  },
  modalSave: {
    backgroundColor: Colors.primary,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
