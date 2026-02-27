/**
 * Modo Criança - Espaço Seguro (Tier 1)
 * UI profissional com gamificação, tokens e grade de apps permitidos.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  StatusBar,
  NativeModules,
  TextInput,
  FlatList,
  Platform,
  InteractionManager,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  getLastLocationTimestamp,
  getLastLocationSnapshot,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from '../../services/location/backgroundLocationService';
import {getChildPairingConfig} from '../../services/pairingService';
import {getCurrentChildId} from '../../services/currentChildService';
import type {AppIconEntry} from '../../assets/appIconCatalog';
import {
  getTokens,
  getAppUnlocks,
  unlockAppWithTokens,
  markTaskDone,
  getTasksDone,
} from '../../services/childTokenService';
import {useChildCreditsApps} from '../../hooks/useChildCreditsApps';
import {useChildTasks} from '../../hooks/useChildTasks';
import {useShieldStatus} from '../../hooks/useShieldStatus';
import {
  isRestModeActive,
  setRestModeActive,
  applyRestModeDisplay,
  requestDisplayPermission,
} from '../../services/restModeService';

import AppGrid from '../../components/child/AppGrid';
import AppIcon from '../../components/apps/AppIcon';
import PinGate from '../../components/security/PinGate';
import ProtectionLevelBadge, {
  computeLevelProgress,
} from '../../components/child/ProtectionLevelBadge';
import {useToast} from '../../components/feedback/ToastProvider';
import {useReviewPrompt} from '../../components/feedback/ReviewPromptProvider';
import {RewardLottieOverlay} from '../../components/feedback/RewardLottieOverlay';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, Spacing, BorderRadius, Shadows} from '../../theme/colors';
import {sendGuardianAlert} from '../../services/notifications/oneSignalService';

const {AppBlockModule, SecurityModule} = NativeModules as any;

const TOKENS_PER_30MIN = 100;

export default function ChildModeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const {showToast} = useToast();
  const {recordReviewSignal} = useReviewPrompt();
  const {
    creditsApps,
    installedApps,
    loading: creditsLoading,
    addApp,
    refresh: refreshCredits,
    loadInstalledApps,
  } = useChildCreditsApps();
  const { tasks, loading: tasksLoading, refresh: refreshTasks } = useChildTasks();
  const { shieldStatus, refreshShieldStatus } = useShieldStatus();
  const [sosHold, setSosHold] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(3);
  const [showDistanceWarning, setShowDistanceWarning] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Inicializando...');
  const [isPaired, setIsPaired] = useState(false);
  const [tokens, setTokens] = useState(150);
  const [unlocks, setUnlocks] = useState<Awaited<ReturnType<typeof getAppUnlocks>>>([]);
  const [tasksDone, setTasksDone] = useState<Set<string>>(new Set());
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [unlockModal, setUnlockModal] = useState<AppIconEntry | null>(null);
  const [addAppModalVisible, setAddAppModalVisible] = useState(false);
  const [addAppSearch, setAddAppSearch] = useState('');
  const [showRewardLottie, setShowRewardLottie] = useState(false);
  const [restModeActive, setRestModeActiveState] = useState(false);
  const [showRestModePinGate, setShowRestModePinGate] = useState(false);
  const [displayPermissionReady, setDisplayPermissionReady] = useState(true);
  const [childId, setChildId] = useState<string>('local-child');
  const sosTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosTriggeredRef = useRef(false);

  const creditsIds = new Set(creditsApps.map(a => a.packageName));
  const permittedApps = creditsApps.filter(
    app => !app.packageName || !blockedApps.has(app.packageName),
  );
  const availableToAdd = installedApps.filter(
    a => !creditsIds.has(a.packageName) &&
      (!addAppSearch.trim() ||
        a.label.toLowerCase().includes(addAppSearch.toLowerCase())),
  );

  const refreshData = useCallback(async () => {
    const [t, u, done, active, blocked] = await Promise.all([
      getTokens(),
      getAppUnlocks(),
      getTasksDone(),
      isRestModeActive(),
      AppBlockModule?.getBlockedApps?.()?.then(
        (arr: string[]) => new Set(arr ?? []),
      ) ?? Promise.resolve(new Set<string>()),
    ]);
    setTokens(t);
    setUnlocks(u);
    setTasksDone(done);
    setRestModeActiveState(active);
    setBlockedApps(blocked);
    refreshCredits();
    refreshTasks();
    refreshShieldStatus();
  }, [refreshCredits, refreshTasks, refreshShieldStatus]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    let mounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!mounted) {
        return;
      }
      if (Platform.OS === 'android' && NativeModules.DisplayWellnessModule) {
        requestDisplayPermission()
          .then(hasPermission => mounted && setDisplayPermissionReady(hasPermission))
          .catch(() => undefined);
        isRestModeActive()
          .then(active => applyRestModeDisplay(active))
          .catch(() => undefined);
      }
    });
    return () => {
      mounted = false;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    getCurrentChildId()
      .then(id => setChildId(id))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    getChildPairingConfig().then(config => setIsPaired(!!config));
  }, []);

  /*
   * Card Sentinela ativo - fluxo de status de localização:
   *
   * Foreground: watchPosition → armazena timestamp em AsyncStorage (LAST_LOCATION_TS_KEY)
   * → publishChildLocation envia ao servidor. O card usa apenas o timestamp local.
   *
   * Background: em RN o watchPosition pode ter precisão/intervalo limitado em segundo plano.
   *
   * Estados: Inicializando... | Aguardando localização... | Conectado e protegido |
   *         Sem atualização recente | Permissão negada | Falha ao iniciar
   */
  const STALE_MINUTES = 10;
  const POLL_INTERVAL_MS = 15000;
  const LOCATION_INIT_TIMEOUT_MS = 35000;

  useEffect(() => {
    const mountedAt = Date.now();
    const task = InteractionManager.runAfterInteractions(() => {
      startBackgroundLocationTracking(childId)
        .then(ok => {
          if (!ok) {
            setLocationStatus('Permissão negada');
            return;
          }
          /* Mantém "Inicializando..." até o primeiro timestamp ou timeout */
        })
        .catch(() => setLocationStatus('Falha ao iniciar'));
    });

    const id = setInterval(() => {
      getLastLocationTimestamp()
        .then(ts => {
          if (!ts) {
            if (Date.now() - mountedAt >= LOCATION_INIT_TIMEOUT_MS) {
              setLocationStatus('Aguardando localização...');
            }
            return;
          }
          const deltaMinutes = Math.floor((Date.now() - ts) / 60000);
          if (deltaMinutes >= STALE_MINUTES) {
            setLocationStatus('Sem atualização recente');
            return;
          }
          setLocationStatus('Conectado e protegido');
        })
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(id);
      stopBackgroundLocationTracking();
      task.cancel();
    };
  }, [childId]);

  const handleTaskPress = async (taskId: string, reward: number) => {
    if (tasksDone.has(taskId)) {
      return;
    }
    const {balance, rewarded} = await markTaskDone(taskId, reward);
    setTokens(balance);
    setTasksDone(prev => new Set([...prev, taskId]));
    setShowRewardLottie(true);
    showToast({
      kind: 'success',
      title: `+${rewarded} tokens!`,
      message: 'Parabéns pela tarefa concluída.',
    });
    refreshData();
  };

  const handleUnlockRequest = (appId: string) => {
    const app = permittedApps.find(a => a.id === appId || a.packageName === appId);
    if (app) {
      setUnlockModal(app);
    }
  };

  const handleAddApp = async (packageName: string, label: string, iconUri?: string) => {
    await addApp(packageName, label, iconUri);
    setAddAppModalVisible(false);
    setAddAppSearch('');
    showToast({ kind: 'success', title: 'App adicionado', message: `${label} disponível para créditos.` });
  };

  const confirmUnlock = async () => {
    const app = unlockModal;
    if (!app || tokens < TOKENS_PER_30MIN) {
      setUnlockModal(null);
      return;
    }
    const packageName = app.packageName ?? app.id;
    const result = await unlockAppWithTokens(packageName, TOKENS_PER_30MIN);
    setUnlockModal(null);
    refreshData();
    if (result.ok) {
      recordReviewSignal('token_unlock_success').catch(() => undefined);
      if (result.expiresAt && AppBlockModule?.addTemporaryUnlock) {
        AppBlockModule.addTemporaryUnlock(packageName, result.expiresAt).catch(() => undefined);
      }
      showToast({
        kind: 'success',
        title: `${app.name} desbloqueado!`,
        message: '30 minutos liberados.',
      });
    } else {
      showToast({
        kind: 'error',
        title: 'Tokens insuficientes',
        message: `Precisa de ${TOKENS_PER_30MIN} tokens.`,
      });
    }
  };

  const handleAppPress = (app: AppIconEntry) => {
    showToast({
      kind: 'info',
      title: app.name,
      message: 'Tempo restante: verifique no app.',
    });
  };

  const protectionActive = shieldStatus.enabled;
  const levelProgress = computeLevelProgress(tokens);

  const exitRestMode = async () => {
    await applyRestModeDisplay(false);
    await setRestModeActive(false);
    setRestModeActiveState(false);
    setShowRestModePinGate(false);
    showToast({kind: 'success', title: 'Modo Descanso desativado'});
  };

  const handleRestModeToggle = async () => {
    if (!restModeActive) {
      try {
        await setRestModeActive(true);
        await applyRestModeDisplay(true);
        setRestModeActiveState(true);
        showToast({kind: 'success', title: 'Modo Descanso ativado'});
      } catch {
        showToast({kind: 'error', title: 'Falha ao ativar Modo Descanso'});
      }
      return;
    }
    const hasPin = await SecurityModule?.hasSecurityPin?.().catch(() => false);
    if (hasPin === false) {
      try {
        await exitRestMode();
      } catch {
        showToast({kind: 'error', title: 'Falha ao desativar Modo Descanso'});
      }
      return;
    }
    setShowRestModePinGate(true);
  };

  const stopSosTimer = () => {
    if (sosTimerRef.current) {
      clearInterval(sosTimerRef.current);
      sosTimerRef.current = null;
    }
  };

  const triggerSos = async () => {
    if (sosTriggeredRef.current) {
      return;
    }
    sosTriggeredRef.current = true;
    stopSosTimer();
    setSosHold(false);
    setSosCountdown(3);

    const location = await getLastLocationSnapshot();
    const locationMessage = location
      ? `Localização: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
      : 'Localização indisponível no momento.';

    const ok = await sendGuardianAlert({
      childId,
      title: 'SOS da criança',
      message: `Alerta de emergência acionado. ${locationMessage}`,
    });

    showToast(
      ok
        ? {kind: 'success', title: 'SOS enviado', message: 'O responsável foi notificado.'}
        : {kind: 'error', title: 'Falha ao enviar SOS', message: 'Tente novamente em instantes.'},
    );
    setTimeout(() => {
      sosTriggeredRef.current = false;
    }, 1500);
  };

  const onSosPressIn = () => {
    if (sosTriggeredRef.current) {
      return;
    }
    setSosHold(true);
    setSosCountdown(3);
    stopSosTimer();
    sosTimerRef.current = setInterval(() => {
      setSosCountdown(prev => {
        if (prev <= 1) {
          triggerSos().catch(() => undefined);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onSosPressOut = () => {
    if (!sosTriggeredRef.current) {
      stopSosTimer();
      setSosHold(false);
      setSosCountdown(3);
    }
  };

  useEffect(() => () => stopSosTimer(), []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" />
      <RewardLottieOverlay
        visible={showRewardLottie}
        onFinish={() => setShowRewardLottie(false)}
      />

      <LinearGradient
        colors={[Colors.childBgStart, Colors.childBgEnd]}
        style={styles.gradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={[styles.header, {paddingTop: insets.top, paddingHorizontal: Spacing.lg}]}>
          <Text style={styles.title}>Espaço Seguro</Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Status pílula */}
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                protectionActive ? styles.statusDotActive : styles.statusDotPaused,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                protectionActive ? styles.statusTextActive : styles.statusTextPaused,
              ]}>
              {protectionActive ? 'Proteção ativa' : 'Proteção pausada'}
            </Text>
          </View>

          {/* Badge de nível */}
          <View style={styles.badgeRow}>
            <ProtectionLevelBadge
              level={levelProgress.level}
              label="Nível"
              progress={levelProgress}
            />
          </View>

          {/* Saldo de Tokens */}
          <View style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Seus Tokens</Text>
            <Text style={styles.tokenValue}>🪙 {tokens}</Text>
          </View>

          {/* Tarefas */}
          <Text style={styles.sectionTitle}>Tarefas</Text>
          {tasksLoading ? (
            <Text style={styles.loadingText}>Carregando tarefas...</Text>
          ) : tasks.length === 0 ? (
            <Text style={styles.emptyTasksText}>
              Nenhuma tarefa. O responsável pode criar em Configurações → Tarefas.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tasksScroll}>
              {tasks.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.taskCard,
                    tasksDone.has(item.id) && styles.taskCardDone,
                  ]}
                  onPress={() => handleTaskPress(item.id, item.rewardCoins)}
                  disabled={tasksDone.has(item.id)}
                  activeOpacity={0.8}>
                  <Text style={styles.taskTitle}>{item.title}</Text>
                  <Text style={styles.taskReward}>
                    {tasksDone.has(item.id) ? '✓ Feito' : `+${item.rewardCoins} 🪙`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Grade de Apps */}
          <View style={styles.appsSectionHeader}>
            <Text style={styles.sectionTitle}>Apps</Text>
            <TouchableOpacity
              style={styles.addAppBtn}
              onPress={() => {
                setAddAppModalVisible(true);
                loadInstalledApps();
              }}>
              <Text style={styles.addAppBtnText}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>
          {creditsLoading && <Text style={styles.loadingText}>Carregando...</Text>}
          {!creditsLoading && permittedApps.length === 0 && (
            <View style={styles.emptyAppsCard}>
              <Text style={styles.emptyAppsText}>
                Nenhum app adicionado. Toque em "Adicionar" para escolher apps que você pode desbloquear com tokens.
              </Text>
              <TouchableOpacity
                style={styles.emptyAppsBtn}
                onPress={() => {
                  setAddAppModalVisible(true);
                  loadInstalledApps();
                }}>
                <Text style={styles.emptyAppsBtnText}>Adicionar app</Text>
              </TouchableOpacity>
            </View>
          )}
          {!creditsLoading && permittedApps.length > 0 && (
            <AppGrid
              apps={permittedApps}
              tokens={tokens}
              unlocks={unlocks}
              onUnlockRequest={handleUnlockRequest}
              onAppPress={handleAppPress}
            />
          )}

          {Platform.OS === 'android' && !displayPermissionReady && (
            <Text style={styles.restModeHint}>
              Conceda permissão de configurações para reduzir o brilho automaticamente.
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.restModeBtn,
              restModeActive ? styles.restModeBtnActive : styles.restModeBtnInactive,
            ]}
            onPress={handleRestModeToggle}>
            <Text style={[styles.restModeBtnText, restModeActive ? styles.restModeBtnTextActive : null]}>
              {restModeActive ? '☀️ Desativar Modo Descanso' : '🌙 Ativar Modo Descanso'}
            </Text>
          </TouchableOpacity>

          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Sentinela ativo</Text>
            <Text style={styles.statusDesc}>{locationStatus}</Text>
            {isPaired && (
              <Text style={styles.pairedBadge}>
                Dispositivo pareado com responsável
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Botão SOS */}
        <Pressable
          style={[styles.sosBtn, sosHold && styles.sosBtnHolding]}
          onPressIn={onSosPressIn}
          onPressOut={onSosPressOut}>
          <Text style={styles.sosText}>
            {sosHold ? `Segure ${sosCountdown}s` : 'Segure 3s'}
          </Text>
          <Text style={styles.sosLabel}>SOS</Text>
        </Pressable>
      </LinearGradient>

      {/* Modal desbloquear app */}
      <Modal
        visible={!!unlockModal}
        transparent
        animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {unlockModal && (
              <>
                <Text style={styles.modalTitle}>
                  Desbloquear {unlockModal.name}?
                </Text>
                <Text style={styles.modalDesc}>
                  {TOKENS_PER_30MIN} tokens = 30 minutos
                </Text>
                <View style={styles.modalRow}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnCancel]}
                    onPress={() => setUnlockModal(null)}>
                    <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnConfirm]}
                    onPress={confirmUnlock}>
                    <Text style={styles.modalBtnConfirmText}>Desbloquear</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Adicionar App */}
      <Modal
        visible={addAppModalVisible}
        transparent
        animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.addAppModal]}>
            <Text style={styles.modalTitle}>Adicionar app</Text>
            <TextInput
              style={styles.addAppSearch}
              placeholder="Buscar app..."
              placeholderTextColor={Colors.textMuted}
              value={addAppSearch}
              onChangeText={setAddAppSearch}
            />
            <FlatList
              data={availableToAdd}
              keyExtractor={item => item.packageName}
              style={styles.addAppList}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.addAppRow}
                  onPress={() => handleAddApp(item.packageName, item.label, item.iconUri)}>
                  <AppIcon name={item.label} size={36} iconUri={item.iconUri} />
                  <Text style={styles.addAppLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.addAppPlus}>+</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyAddText}>
                  {installedApps.length === 0
                    ? 'Nenhum app instalado.'
                    : 'Todos os apps já foram adicionados ou não há resultados.'}
                </Text>
              }
            />
            <TouchableOpacity
              style={styles.modalBtnCancel}
              onPress={() => { setAddAppModalVisible(false); setAddAppSearch(''); }}>
              <Text style={styles.modalBtnCancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Screen Distance */}
      <Modal
        visible={showDistanceWarning}
        transparent
        animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.distanceCard}>
            <Text style={styles.distanceIcon}>⚠️</Text>
            <Text style={styles.distanceTitle}>Rosto muito perto!</Text>
            <Text style={styles.distanceDesc}>Afaste-se para continuar</Text>
            <TouchableOpacity
              style={styles.distanceBtn}
              onPress={() => setShowDistanceWarning(false)}>
              <Text style={styles.distanceBtnText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PinGate
        visible={showRestModePinGate}
        onClose={() => setShowRestModePinGate(false)}
        onSuccess={exitRestMode}
        title="Digite o PIN para encerrar o Modo Descanso"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  gradient: {flex: 1},
  scroll: {flex: 1},
  scrollContent: {
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    padding: 16,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
    backgroundColor: Colors.childAmber,
  },
  statusDotActive: {
    backgroundColor: Colors.childMint,
  },
  statusDotPaused: {
    backgroundColor: Colors.childAmber,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusTextActive: {color: Colors.childMint},
  statusTextPaused: {color: Colors.childAmber},

  badgeRow: {marginBottom: Spacing.lg},

  tokenCard: {
    backgroundColor: Colors.childCard,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...Shadows.soft,
  },
  tokenLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.gold,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  appsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  addAppBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addAppBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.md },
  emptyAppsCard: {
    backgroundColor: Colors.childCard,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...Shadows.soft,
  },
  emptyAppsText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyAppsBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  emptyAppsBtnText: { color: Colors.white, fontWeight: '700' },
  emptyTasksText: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg },
  addAppModal: { maxHeight: '80%' },
  addAppSearch: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addAppList: { maxHeight: 280, marginBottom: Spacing.md },
  addAppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  addAppLabel: { flex: 1, fontSize: 16, color: Colors.textPrimary, marginLeft: Spacing.md },
  addAppPlus: { fontSize: 24, color: Colors.primary, fontWeight: '700' },
  emptyAddText: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.lg },
  tasksScroll: {marginBottom: Spacing.lg},
  taskCard: {
    backgroundColor: Colors.childCard,
    borderRadius: BorderRadius.pill,
    padding: Spacing.lg,
    width: 160,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...Shadows.soft,
  },
  taskCardDone: {
    opacity: 0.8,
    backgroundColor: 'rgba(78,205,196,0.2)',
    borderColor: Colors.childMint,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  taskReward: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gold,
    marginTop: 8,
  },

  restModeHint: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  restModeBtn: {
    marginTop: Spacing.sm,
    borderRadius: 24,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  restModeBtnActive: {
    backgroundColor: 'rgba(120,53,15,0.9)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  restModeBtnInactive: {
    backgroundColor: 'rgba(26,26,46,0.9)',
    borderColor: 'rgba(78,205,196,0.3)',
  },
  restModeBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  restModeBtnTextActive: {
    color: '#FEF3C7',
  },
  statusCard: {
    marginTop: Spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  statusTitle: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  statusDesc: {
    color: Colors.textSecondary,
    marginTop: 4,
    fontSize: 12,
  },
  pairedBadge: {
    marginTop: 8,
    color: Colors.childMint,
    fontSize: 11,
    fontWeight: '600',
  },

  sosBtn: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.medium,
  },
  sosBtnHolding: {
    transform: [{scale: 1.1}],
    backgroundColor: '#E53935',
  },
  sosText: {
    fontSize: 9,
    color: Colors.white,
    fontWeight: '600',
  },
  sosLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  modalDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  modalRow: {flexDirection: 'row', gap: Spacing.md},
  modalBtn: {flex: 1, padding: Spacing.md, borderRadius: 12, alignItems: 'center'},
  modalBtnCancel: {backgroundColor: Colors.border},
  modalBtnConfirm: {backgroundColor: Colors.primary},
  modalBtnCancelText: {color: Colors.textSecondary, fontWeight: '600'},
  modalBtnConfirmText: {color: Colors.white, fontWeight: '700'},

  distanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  distanceIcon: {fontSize: 48, marginBottom: Spacing.md},
  distanceTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.alert,
    marginBottom: Spacing.sm,
  },
  distanceDesc: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  distanceBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  distanceBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
