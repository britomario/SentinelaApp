import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {Marker} from 'react-native-maps';
import {useNavigation} from '@react-navigation/native';

import GuidedTourOverlay from '../../components/tour/GuidedTourOverlay';
import type {TourAnchor} from '../../components/tour/GuidedTourOverlay';
import Skeleton from '../../components/feedback/Skeleton';
import {useToast} from '../../components/feedback/ToastProvider';
import {useReviewPrompt} from '../../components/feedback/ReviewPromptProvider';
import {analyzeOnDevice} from '../../ai/onDeviceNlp';
import {getCurrentChildId} from '../../services/currentChildService';
import {hasSeenTour, markTourSeen} from '../../services/onboardingState';
import {sendGuardianAlert} from '../../services/notifications/oneSignalService';
import {subscribeToChildLocation} from '../../services/realtime/socketService';
import {useShieldStatus} from '../../hooks/useShieldStatus';
import {toggleShield} from '../../services/shieldService';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

const {AppBlockModule} = NativeModules as any;

const WEEK_DATA = [
  {day: 'Seg', minutes: 0},
  {day: 'Ter', minutes: 0},
  {day: 'Qua', minutes: 0},
  {day: 'Qui', minutes: 0},
  {day: 'Sex', minutes: 0},
  {day: 'Sab', minutes: 0},
  {day: 'Dom', minutes: 0},
];

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
];

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const {showToast} = useToast();
  const {recordReviewSignal} = useReviewPrompt();
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
  const [isShieldLoading, setIsShieldLoading] = useState(false);
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
  const {shieldStatus, refreshShieldStatus} = useShieldStatus();

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
  const shieldActive = shieldStatus.enabled && shieldStatus.vpnActive;

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

  const onToggleShield = async (enabled: boolean) => {
    if (isShieldLoading) {
      return;
    }
    setIsShieldLoading(true);
    try {
      const result = await toggleShield(enabled);
      await refreshShieldStatus();
      if (enabled && !result.enabled) {
        showToast({
          kind: 'info',
          title: 'Escudo não suportado',
          message: 'Este dispositivo ainda não possui ativação nativa disponível.',
        });
        return;
      }
      showToast({
        kind: 'success',
        title: enabled ? 'Escudo ativo' : 'Proteção pausada',
      });
    } catch (error) {
      console.error('[Dashboard] Shield toggle failed', {
        enabled,
        error,
      });
      showToast({
        kind: 'error',
        title: 'Não foi possível conectar ao Escudo',
        message: 'Verifique sua internet e tente novamente.',
      });
    } finally {
      setIsShieldLoading(false);
    }
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
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>Ola, Maria</Text>
            <Text style={styles.subGreeting}>Visao geral da seguranca</Text>
            <View
              style={[
                styles.shieldPill,
                shieldActive ? styles.shieldPillActive : styles.shieldPillPaused,
              ]}>
              <View
                style={[
                  styles.shieldDot,
                  shieldActive ? styles.shieldDotActive : styles.shieldDotPaused,
                ]}
              />
              <Text
                style={[
                  styles.shieldText,
                  shieldActive ? styles.shieldTextActive : styles.shieldTextPaused,
                ]}>
                {shieldActive ? 'Proteção Ativa' : 'Proteção Pausada'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Switch
              value={shieldActive}
              onValueChange={onToggleShield}
              disabled={isShieldLoading}
              trackColor={{false: '#FCA5A5', true: '#86EFAC'}}
              thumbColor={shieldActive ? '#16A34A' : '#F97316'}
            />
            {isShieldLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : null}
            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => {
                setTourStep(0);
                setTourVisible(true);
              }}>
              <Text style={styles.helpButtonText}>?</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Escudo Principal</Text>
            <Text style={styles.cardDesc}>
              {shieldActive
                ? 'Tráfego protegido por DNS filtrado e bloqueio em tempo real.'
                : 'Ative o escudo para forçar proteção de rede e bloquear conteúdo sensível.'}
            </Text>
          </View>
        </View>

        <View style={styles.section} ref={climateRef}>
          <View style={styles.card}>
            {isLoading ? (
              <>
                <Skeleton height={140} radius={16} />
                <Skeleton width="68%" style={styles.skeletonSpacer10} />
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
                <Skeleton width="100%" style={styles.skeletonSpacer10} />
                <Skeleton width="70%" style={styles.skeletonSpacer8} />
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Clima Emocional {climateEmoji}</Text>
                <Text
                  style={
                    climate.wellbeing.level === 'green'
                      ? styles.scoreGreen
                      : styles.scoreAmber
                  }>
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

      </ScrollView>
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
  headerInfo: {flex: 1},
  headerActions: {alignItems: 'center', gap: Spacing.sm},
  greeting: {fontSize: 24, fontWeight: '700', color: Colors.textPrimary},
  subGreeting: {fontSize: 14, color: Colors.textSecondary, marginTop: 2},
  shieldPill: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  shieldPillActive: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  shieldPillPaused: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249,115,22,0.14)',
  },
  shieldDot: {width: 8, height: 8, borderRadius: 4, marginRight: 8},
  shieldDotActive: {backgroundColor: '#16A34A'},
  shieldDotPaused: {backgroundColor: '#EA580C'},
  shieldText: {fontSize: 12, fontWeight: '700'},
  shieldTextActive: {color: '#15803D'},
  shieldTextPaused: {color: '#C2410C'},
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
  scoreGreen: {marginTop: 8, fontWeight: '700' as const, color: Colors.mint},
  scoreAmber: {marginTop: 8, fontWeight: '700' as const, color: '#F59E0B'},
  skeletonSpacer10: {marginTop: 10},
  skeletonSpacer8: {marginTop: 8},
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
