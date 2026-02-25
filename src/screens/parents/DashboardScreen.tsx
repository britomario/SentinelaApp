import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  Modal,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {Marker} from 'react-native-maps';
import {useNavigation} from '@react-navigation/native';

import GuidedTourOverlay from '../../components/tour/GuidedTourOverlay';
import type {TourAnchor} from '../../components/tour/GuidedTourOverlay';
import AppIcon from '../../components/apps/AppIcon';
import Skeleton from '../../components/feedback/Skeleton';
import {useToast} from '../../components/feedback/ToastProvider';
import {useReviewPrompt} from '../../components/feedback/ReviewPromptProvider';
import {analyzeOnDevice} from '../../ai/onDeviceNlp';
import {getCurrentChildId} from '../../services/currentChildService';
import {hasSeenTour, markTourSeen} from '../../services/onboardingState';
import {sendGuardianAlert} from '../../services/notifications/oneSignalService';
import {dispatchQuickAction} from '../../services/quickActionsDispatchService';
import {executeQuickActionLocally} from '../../services/quickActionsLocalExecutor';
import {subscribeToChildLocation} from '../../services/realtime/socketService';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

const {AppBlockModule} = NativeModules as any;

const QUICK_ACTIONS: Array<{
  id: string;
  label: string;
  icon: string;
  action: import('../../services/quickActionsDispatchService').QuickActionType;
}> = [
  {id: '1', label: 'Bloquear Agora', icon: '⏸️', action: 'block_now'},
  {id: '2', label: 'Adicionar 30min', icon: '➕', action: 'grant_time'},
  {id: '3', label: 'Ver Tela Ao Vivo', icon: '📺', action: 'live_screen_request'},
];

const WEEK_DATA = [
  {day: 'Seg', minutes: 0},
  {day: 'Ter', minutes: 0},
  {day: 'Qua', minutes: 0},
  {day: 'Qui', minutes: 0},
  {day: 'Sex', minutes: 0},
  {day: 'Sab', minutes: 0},
  {day: 'Dom', minutes: 0},
];

function QuickActionButton({
  quickAction,
  onPress,
  loading,
}: {
  quickAction: (typeof QUICK_ACTIONS)[0];
  onPress: () => void;
  loading: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      disabled={loading}>
      <Text style={styles.actionIcon}>{quickAction.icon}</Text>
      <Text style={styles.actionLabel}>
        {loading ? 'Enviando...' : quickAction.label}
      </Text>
    </TouchableOpacity>
  );
}

const DASHBOARD_TOUR = [
  {
    anchorKey: 'header',
    title: 'Visao geral da familia',
    description: 'Aqui voce acompanha status de seguranca, uso e alertas em um unico painel.',
  },
  {
    anchorKey: 'climate',
    title: 'Clima emocional',
    description: 'Este card resume sinais de bem-estar processados localmente no aparelho.',
  },
  {
    anchorKey: 'actions',
    title: 'Acoes rapidas',
    description: 'Use estes atalhos para agir imediatamente em situacoes de risco.',
  },
];

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const {showToast} = useToast();
  const {recordReviewSignal} = useReviewPrompt();
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionSearch, setActionSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<
    import('../../services/quickActionsDispatchService').QuickActionType | null
  >(null);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [installedApps, setInstalledApps] = useState<
    Array<{packageName: string; label: string; iconUri?: string}>
  >([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [usageWeek, setUsageWeek] = useState(WEEK_DATA);
  const [usageApps, setUsageApps] = useState<
    Array<{packageName: string; label: string; minutes: number; iconUri?: string}>
  >([]);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [childId, setChildId] = useState<string>('local-child');
  const [isLoading, setIsLoading] = useState(true);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourAnchors, setTourAnchors] = useState<Record<string, TourAnchor>>({});
  const [childLocation, setChildLocation] = useState<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);
  const recordedClimateSignal = useRef(false);
  const dispatchedAlert = useRef(false);
  const staleLocationAlertSent = useRef(false);
  const headerRef = useRef<View>(null);
  const climateRef = useRef<View>(null);
  const actionsRef = useRef<View>(null);

  const filteredApps = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    if (!q) {
      return installedApps;
    }
    return installedApps.filter(
      app =>
        app.label.toLowerCase().includes(q) ||
        app.packageName.toLowerCase().includes(q),
    );
  }, [actionSearch, installedApps]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 850);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    getCurrentChildId()
      .then(id => setChildId(id))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToChildLocation(childId, payload => {
      setChildLocation({
        latitude: payload.latitude,
        longitude: payload.longitude,
        timestamp: payload.timestamp,
      });
    });
    return unsubscribe;
  }, [childId]);

  useEffect(() => {
    hasSeenTour('dashboard').then(seen => {
      if (!seen) {
        setTourVisible(true);
      }
    });
  }, []);

  const measureTourAnchors = () => {
    const items: Array<{key: string; ref: React.RefObject<View>}> = [
      {key: 'header', ref: headerRef},
      {key: 'climate', ref: climateRef},
      {key: 'actions', ref: actionsRef},
    ];
    items.forEach(item => {
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

  const climate = useMemo(
    () =>
      analyzeOnDevice([
        'Hoje foi legal na escola e estou feliz',
        'Meu amigo foi muito chato comigo',
        'Gostei da aula de ciencias e me diverti',
      ]),
    [],
  );

  const maxUsage = Math.max(1, ...usageWeek.map(d => d.minutes));
  const climateEmoji = climate.wellbeing.level === 'green' ? '😊' : '🙂';
  const climateColor = climate.wellbeing.level === 'green' ? Colors.mint : '#F59E0B';

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (recordedClimateSignal.current) {
      return;
    }
    if (climate.wellbeing.level !== 'green') {
      return;
    }
    recordedClimateSignal.current = true;
    recordReviewSignal('climate_green_visible').catch(() => undefined);
  }, [climate.wellbeing.level, isLoading, recordReviewSignal]);

  useEffect(() => {
    if (isLoading || dispatchedAlert.current) {
      return;
    }
    if (!climate.topRisk) {
      return;
    }
    dispatchedAlert.current = true;
    sendGuardianAlert({
      childId,
      title: 'Sentinela: alerta emocional',
      message: `Sinal de risco detectado (${climate.topRisk}).`,
    }).catch(() => undefined);
  }, [childId, climate.topRisk, isLoading]);

  useEffect(() => {
    if (!childLocation) {
      return;
    }
    const staleMs = Date.now() - childLocation.timestamp;
    if (staleMs < 10 * 60 * 1000) {
      staleLocationAlertSent.current = false;
      return;
    }
    if (staleLocationAlertSent.current) {
      return;
    }
    staleLocationAlertSent.current = true;
    sendGuardianAlert({
      childId,
      title: 'Sentinela: localizacao sem atualizacao',
      message: 'O dispositivo monitorado esta sem atualizacao de localizacao ha mais de 10 minutos.',
    }).catch(() => undefined);
  }, [childId, childLocation]);

  const closeTour = () => {
    markTourSeen('dashboard').catch(() => undefined);
    setTourVisible(false);
    setTourStep(0);
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h <= 0) {
      return `${m}min`;
    }
    return `${h}h ${m}min`;
  };

  useEffect(() => {
    const loadUsage = async () => {
      try {
        if (!AppBlockModule?.getUsageSummary) {
          return;
        }
        const payload = await AppBlockModule.getUsageSummary();
        if (payload?.weekly && Array.isArray(payload.weekly)) {
          setUsageWeek(
            payload.weekly.map((d: {day?: string; minutes?: number}) => ({
              day: d.day ?? '-',
              minutes: Number(d.minutes ?? 0),
            })),
          );
        }
        if (payload?.topApps && Array.isArray(payload.topApps)) {
          setUsageApps(
            payload.topApps.map(
              (a: {packageName?: string; label?: string; minutes?: number; iconUri?: string}) => ({
                packageName: a.packageName ?? '',
                label: a.label ?? a.packageName ?? '',
                minutes: Number(a.minutes ?? 0),
                iconUri: a.iconUri ?? undefined,
              }),
            ),
          );
        }
      } catch {
        // Keep UI alive with fallback.
      }
    };
    loadUsage().catch(() => undefined);
  }, []);

  const runQuickAction = async (
    action: import('../../services/quickActionsDispatchService').QuickActionType,
    packages: string[] = [],
  ) => {
    setActionLoading(prev => ({...prev, [action]: true}));
    const result = await dispatchQuickAction(action, childId);
    const localExecuted = result.ok
      ? await executeQuickActionLocally(action, {packages})
      : false;
    setActionLoading(prev => ({...prev, [action]: false}));
    if (result.ok) {
      showToast({
        kind: 'success',
        title: 'Ação executada',
        message: localExecuted
          ? 'Aplicada ao(s) app(s) selecionado(s).'
          : result.localOnly
            ? 'Ação registrada localmente.'
            : 'Comando encaminhado ao dispositivo monitorado.',
      });
      return;
    }
    showToast({
      kind: 'error',
      title: 'Falha ao enviar',
      message:
        result.reason === 'api_not_configured'
          ? 'Configure SYNC_API_BASE_URL para uso remoto.'
          : 'Tente novamente em instantes.',
    });
  };

  const openQuickAction = async (
    action: import('../../services/quickActionsDispatchService').QuickActionType,
  ) => {
    if (action === 'live_screen_request') {
      await runQuickAction(action);
      return;
    }
    setSelectedAction(action);
    setActionSearch('');
    setSelectedPackages(new Set());
    setActionModalVisible(true);
    setLoadingApps(true);
    try {
      const raw = AppBlockModule?.getInstalledApps
        ? await AppBlockModule.getInstalledApps()
        : [];
      const list = Array.isArray(raw)
        ? raw.map((a: {packageName?: string; label?: string; iconUri?: string}) => ({
            packageName: a.packageName ?? '',
            label: a.label ?? a.packageName ?? '',
            iconUri: a.iconUri ?? undefined,
          }))
        : [];
      list.sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}),
      );
      setInstalledApps(list);
    } finally {
      setLoadingApps(false);
    }
  };

  const toggleSelectedPackage = (pkg: string) => {
    setSelectedPackages(prev => {
      const next = new Set(prev);
      if (next.has(pkg)) {
        next.delete(pkg);
      } else {
        next.add(pkg);
      }
      return next;
    });
  };

  const confirmQuickActionSelection = async () => {
    if (!selectedAction) {
      return;
    }
    const packages = Array.from(selectedPackages);
    if (packages.length === 0) {
      showToast({kind: 'error', title: 'Selecione pelo menos um app'});
      return;
    }
    setActionModalVisible(false);
    await runQuickAction(selectedAction, packages);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <GuidedTourOverlay
        visible={tourVisible}
        steps={DASHBOARD_TOUR}
        stepIndex={tourStep}
        anchor={tourAnchors[DASHBOARD_TOUR[tourStep]?.anchorKey]}
        onClose={closeTour}
        onNext={() => {
          if (tourStep >= DASHBOARD_TOUR.length - 1) {
            closeTour();
            return;
          }
          setTourStep(prev => prev + 1);
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header} ref={headerRef}>
          <View>
            <Text style={styles.greeting}>Ola, Maria</Text>
            <Text style={styles.subGreeting}>Visao geral da seguranca</Text>
          </View>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => {
              setTourStep(0);
              setTourVisible(true);
            }}>
            <Text style={styles.helpButtonText}>?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section} ref={climateRef}>
          <View style={styles.card}>
            {isLoading ? (
              <>
                <Skeleton height={140} radius={16} />
                <Skeleton width="68%" style={{marginTop: 10}} />
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Mapa de localizacao</Text>
                {childLocation ? (
                  <>
                    <MapView
                      style={styles.map}
                      initialRegion={{
                        latitude: childLocation.latitude,
                        longitude: childLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      region={{
                        latitude: childLocation.latitude,
                        longitude: childLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}>
                      <Marker
                        coordinate={{
                          latitude: childLocation.latitude,
                          longitude: childLocation.longitude,
                        }}
                        title="Dispositivo monitorado"
                        description="Atualizacao em tempo real"
                      />
                    </MapView>
                    <Text style={styles.cardDesc}>
                      Ultima atualizacao:{' '}
                      {new Date(childLocation.timestamp).toLocaleTimeString('pt-BR')}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.cardDesc}>
                    Aguardando primeira coordenada do dispositivo monitorado.
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            {isLoading ? (
              <>
                <Skeleton width="45%" height={18} />
                <Skeleton width="100%" style={{marginTop: 10}} />
                <Skeleton width="70%" style={{marginTop: 8}} />
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Clima Emocional {climateEmoji}</Text>
                <Text style={[styles.score, {color: climateColor}]}>
                  Score de bem-estar: {climate.wellbeing.score}/100
                </Text>
                <Text style={styles.cardDesc}>{climate.summary}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('UsageDetails', {apps: usageApps})}>
              <Text style={styles.cardTitle}>Uso semanal</Text>
              <View style={styles.chartRow}>
                {usageWeek.map(d => (
                  <TouchableOpacity
                    key={d.day}
                    style={styles.barWrapper}
                    onPress={() =>
                      setSelectedBar(prev => (prev === d.day ? null : d.day))
                    }>
                    {selectedBar === d.day && (
                      <View style={styles.tooltip}>
                        <Text style={styles.tooltipText}>{formatMinutes(d.minutes)}</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(d.minutes / maxUsage) * 100}%`,
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>{d.day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.chartHint}>
                Toque em uma barra para ver o tempo e toque no card para abrir o ranking de apps.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section} ref={actionsRef}>
          <Text style={styles.sectionTitle}>Acoes rapidas</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map(quickAction => (
              <QuickActionButton
                key={quickAction.id}
                quickAction={quickAction}
                loading={!!actionLoading[quickAction.action]}
                onPress={() => {
                  openQuickAction(quickAction.action).catch(() =>
                    showToast({
                      kind: 'error',
                      title: 'Falha ao carregar apps',
                    }),
                  );
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={actionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedAction === 'block_now'
                ? 'Bloquear agora: selecionar apps'
                : 'Adicionar 30 min: selecionar apps'}
            </Text>
            <TextInput
              style={styles.modalSearch}
              value={actionSearch}
              onChangeText={setActionSearch}
              placeholder="Pesquisar app..."
              placeholderTextColor={Colors.textMuted}
            />
            {loadingApps ? (
              <Text style={styles.modalHint}>Carregando apps...</Text>
            ) : (
              <FlatList
                data={filteredApps}
                keyExtractor={item => item.packageName}
                style={styles.modalList}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => toggleSelectedPackage(item.packageName)}>
                    <AppIcon name={item.label} iconUri={item.iconUri} size={32} />
                    <Text style={styles.modalRowText} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.modalCheck}>
                      {selectedPackages.has(item.packageName) ? '✓' : '+'}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setActionModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={() => {
                  confirmQuickActionSelection().catch(() => undefined);
                }}>
                <Text style={styles.modalBtnConfirmText}>Confirmar</Text>
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
  scrollContent: {paddingBottom: Spacing.xxl},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  greeting: {fontSize: 24, fontWeight: '700', color: Colors.textPrimary},
  subGreeting: {fontSize: 14, color: Colors.textSecondary, marginTop: 2},
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: {color: '#334155', fontWeight: '800'},
  section: {paddingHorizontal: Spacing.lg, marginTop: Spacing.md},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.low,
  },
  cardTitle: {fontSize: 17, fontWeight: '700', color: Colors.textPrimary},
  cardDesc: {fontSize: 14, color: Colors.textSecondary, marginTop: 6, lineHeight: 20},
  map: {marginTop: 10, width: '100%', height: 170, borderRadius: 12},
  score: {marginTop: 8, fontWeight: '700'},
  chartRow: {
    marginTop: 12,
    height: 112,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {flex: 1, alignItems: 'center'},
  bar: {width: 20, minHeight: 8, borderRadius: 6, backgroundColor: Colors.primary},
  barLabel: {fontSize: 11, color: Colors.textMuted, marginTop: 4},
  tooltip: {
    position: 'absolute',
    top: -26,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 10,
  },
  tooltipText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  chartHint: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  actionsGrid: {flexDirection: 'row', gap: Spacing.sm},
  actionBtn: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.low,
  },
  actionIcon: {fontSize: 24, marginBottom: 4},
  actionLabel: {fontSize: 12, color: Colors.textPrimary, fontWeight: '600'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '78%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalSearch: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  modalHint: {
    color: Colors.textSecondary,
    paddingVertical: Spacing.md,
  },
  modalList: {
    maxHeight: 360,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalRowText: {
    flex: 1,
    marginLeft: Spacing.md,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  modalCheck: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.border,
  },
  modalBtnConfirm: {
    backgroundColor: Colors.primary,
  },
  modalBtnCancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modalBtnConfirmText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
