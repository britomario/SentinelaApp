import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {Marker} from 'react-native-maps';

import GuidedTourOverlay from '../../components/tour/GuidedTourOverlay';
import Skeleton from '../../components/feedback/Skeleton';
import {useToast} from '../../components/feedback/ToastProvider';
import {useReviewPrompt} from '../../components/feedback/ReviewPromptProvider';
import {analyzeOnDevice} from '../../ai/onDeviceNlp';
import {hasSeenTour, markTourSeen} from '../../services/onboardingState';
import {sendGuardianAlert} from '../../services/notifications/oneSignalService';
import {dispatchQuickAction} from '../../services/quickActionsDispatchService';
import {subscribeToChildLocation} from '../../services/realtime/socketService';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

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
  {day: 'Seg', value: 4.2},
  {day: 'Ter', value: 3.8},
  {day: 'Qua', value: 4.5},
  {day: 'Qui', value: 3.2},
  {day: 'Sex', value: 5.1},
  {day: 'Sab', value: 6},
  {day: 'Dom', value: 5.5},
];

function QuickActionButton({
  quickAction,
  childId,
  showToast,
}: {
  quickAction: (typeof QUICK_ACTIONS)[0];
  childId: string;
  showToast: (o: {kind: 'success' | 'error'; title: string; message?: string}) => void;
}): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);
  const onPress = async () => {
    setLoading(true);
    const result = await dispatchQuickAction(quickAction.action, childId);
    setLoading(false);
    if (result.ok) {
      showToast({
        kind: 'success',
        title: `${quickAction.label} executado`,
        message:
          result.localOnly
            ? 'Acao registrada. Configure SYNC_API_BASE_URL para envio remoto.'
            : 'Comando encaminhado ao dispositivo monitorado.',
      });
    } else {
      showToast({
        kind: 'error',
        title: 'Falha ao enviar',
        message: result.reason === 'api_not_configured'
          ? 'Configure SYNC_API_BASE_URL para usar acoes remotas.'
          : 'Tente novamente em instantes.',
      });
    }
  };
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
    title: 'Visao geral da familia',
    description: 'Aqui voce acompanha status de seguranca, uso e alertas em um unico painel.',
  },
  {
    title: 'Clima emocional',
    description: 'Este card resume sinais de bem-estar processados localmente no aparelho.',
  },
  {
    title: 'Acoes rapidas',
    description: 'Use estes atalhos para agir imediatamente em situacoes de risco.',
  },
];

export default function DashboardScreen(): React.JSX.Element {
  const {showToast} = useToast();
  const {recordReviewSignal} = useReviewPrompt();
  const [isLoading, setIsLoading] = useState(true);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [childLocation, setChildLocation] = useState<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);
  const recordedClimateSignal = useRef(false);
  const dispatchedAlert = useRef(false);
  const staleLocationAlertSent = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 850);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToChildLocation('mock-child-id', payload => {
      setChildLocation({
        latitude: payload.latitude,
        longitude: payload.longitude,
        timestamp: payload.timestamp,
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    hasSeenTour('dashboard').then(seen => {
      if (!seen) {
        setTourVisible(true);
      }
    });
  }, []);

  const climate = useMemo(
    () =>
      analyzeOnDevice([
        'Hoje foi legal na escola e estou feliz',
        'Meu amigo foi muito chato comigo',
        'Gostei da aula de ciencias e me diverti',
      ]),
    [],
  );

  const maxUsage = Math.max(...WEEK_DATA.map(d => d.value));
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
      childId: 'mock-child-id',
      title: 'Sentinela: alerta emocional',
      message: `Sinal de risco detectado (${climate.topRisk}).`,
    }).catch(() => undefined);
  }, [climate.topRisk, isLoading]);

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
      childId: 'mock-child-id',
      title: 'Sentinela: localizacao sem atualizacao',
      message: 'O dispositivo monitorado esta sem atualizacao de localizacao ha mais de 10 minutos.',
    }).catch(() => undefined);
  }, [childLocation]);

  const closeTour = () => {
    markTourSeen('dashboard').catch(() => undefined);
    setTourVisible(false);
    setTourStep(0);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <GuidedTourOverlay
        visible={tourVisible}
        steps={DASHBOARD_TOUR}
        stepIndex={tourStep}
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
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ola, Maria</Text>
            <Text style={styles.subGreeting}>Visao geral da seguranca</Text>
          </View>
          <TouchableOpacity style={styles.helpButton} onPress={() => setTourVisible(true)}>
            <Text style={styles.helpButtonText}>?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
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
            <Text style={styles.cardTitle}>Uso semanal</Text>
            <View style={styles.chartRow}>
              {WEEK_DATA.map(d => (
                <View key={d.day} style={styles.barWrapper}>
                  <View style={[styles.bar, {height: `${(d.value / maxUsage) * 100}%`}]} />
                  <Text style={styles.barLabel}>{d.day}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acoes rapidas</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map(quickAction => (
              <QuickActionButton
                key={quickAction.id}
                quickAction={quickAction}
                childId="mock-child-id"
                showToast={showToast}
              />
            ))}
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
});
