/**
 * Modo Criança - Espaço Seguro (Tier 1)
 * UI profissional com gamificação, tokens e grade de apps permitidos.
 */

import React, {useCallback, useEffect, useState} from 'react';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  getLastLocationTimestamp,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from '../../services/location/backgroundLocationService';
import {getChildPairingConfig} from '../../services/pairingService';
import {
  getCatalogForChildMode,
  type AppIconEntry,
} from '../../assets/appIconCatalog';
import {
  getTokens,
  getAppUnlocks,
  unlockAppWithTokens,
  markTaskDone,
  getTasksDone,
} from '../../services/childTokenService';

import AppGrid from '../../components/child/AppGrid';
import ProtectionLevelBadge from '../../components/child/ProtectionLevelBadge';
import {useToast} from '../../components/feedback/ToastProvider';
import {Colors, Spacing, BorderRadius, Shadows} from '../../theme/colors';

const {AppBlockModule} = NativeModules as any;

const TASKS = [
  {id: '1', title: 'Arrume o quarto', reward: 50},
  {id: '2', title: 'Leia por 20min', reward: 100},
  {id: '3', title: 'Pratique exercício', reward: 75},
];
const TOKENS_PER_30MIN = 100;

export default function ChildModeScreen(): React.JSX.Element {
  const {showToast} = useToast();
  const [sosHold, setSosHold] = useState(false);
  const [showDistanceWarning, setShowDistanceWarning] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Inicializando...');
  const [isPaired, setIsPaired] = useState(false);
  const [tokens, setTokens] = useState(150);
  const [unlocks, setUnlocks] = useState<Awaited<ReturnType<typeof getAppUnlocks>>>([]);
  const [tasksDone, setTasksDone] = useState<Set<string>>(new Set());
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [permittedApps, setPermittedApps] = useState<AppIconEntry[]>([]);
  const [unlockModal, setUnlockModal] = useState<AppIconEntry | null>(null);

  const refreshData = useCallback(async () => {
    const [t, u, done, blocked] = await Promise.all([
      getTokens(),
      getAppUnlocks(),
      getTasksDone(),
      AppBlockModule?.getBlockedApps?.()?.then(
        (arr: string[]) => new Set(arr ?? []),
      ) ?? Promise.resolve(new Set<string>()),
    ]);
    setTokens(t);
    setUnlocks(u);
    setTasksDone(done);
    setBlockedApps(blocked);

    const catalog = getCatalogForChildMode();
    const permitted = catalog.filter(
      app =>
        !app.packageName || !blocked.has(app.packageName),
    );
    setPermittedApps(permitted);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    getChildPairingConfig().then(config => setIsPaired(!!config));
  }, []);

  useEffect(() => {
    startBackgroundLocationTracking('mock-child-id')
      .then(ok => {
        if (!ok) {
          setLocationStatus('Permissão de localização negada.');
          return;
        }
        setLocationStatus('Conectado e protegido.');
      })
      .catch(() => setLocationStatus('Falha ao iniciar rastreamento.'));

    const id = setInterval(() => {
      getLastLocationTimestamp()
        .then(ts => {
          if (!ts) return;
          const deltaMinutes = Math.floor((Date.now() - ts) / 60000);
          if (deltaMinutes >= 10) {
            setLocationStatus('Sem atualização recente. Verifique a conexão.');
            return;
          }
          setLocationStatus('Conectado e protegido.');
        })
        .catch(() => undefined);
    }, 15000);

    return () => {
      clearInterval(id);
      stopBackgroundLocationTracking();
    };
  }, []);

  const handleTaskPress = async (taskId: string, reward: number) => {
    if (tasksDone.has(taskId)) return;
    const newBalance = await markTaskDone(taskId, reward);
    setTokens(newBalance);
    setTasksDone(prev => new Set([...prev, taskId]));
    showToast({
      kind: 'success',
      title: `+${reward} tokens!`,
      message: 'Parabéns pela tarefa concluída.',
    });
    refreshData();
  };

  const handleUnlockRequest = (appId: string) => {
    const app = permittedApps.find(a => a.id === appId);
    if (app) setUnlockModal(app);
  };

  const confirmUnlock = async () => {
    const app = unlockModal;
    if (!app || tokens < TOKENS_PER_30MIN) {
      setUnlockModal(null);
      return;
    }
    const result = await unlockAppWithTokens(app.id, TOKENS_PER_30MIN);
    setUnlockModal(null);
    refreshData();
    if (result.ok) {
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

  const protectionActive = locationStatus.includes('Conectado');
  const level = Math.min(5, Math.floor(tokens / 50) + 1);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" />

      <LinearGradient
        colors={[Colors.childBgStart, Colors.childBgEnd]}
        style={styles.gradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
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
              {protectionActive ? 'Conectado e Seguro' : 'Proteção Pausada'}
            </Text>
          </View>

          {/* Badge de nível */}
          <View style={styles.badgeRow}>
            <ProtectionLevelBadge level={level} label="Nível" />
          </View>

          {/* Saldo de Tokens */}
          <View style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Seus Tokens</Text>
            <Text style={styles.tokenValue}>🪙 {tokens}</Text>
          </View>

          {/* Tarefas */}
          <Text style={styles.sectionTitle}>Tarefas</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tasksScroll}>
            {TASKS.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.taskCard,
                  tasksDone.has(item.id) && styles.taskCardDone,
                ]}
                onPress={() => handleTaskPress(item.id, item.reward)}
                disabled={tasksDone.has(item.id)}
                activeOpacity={0.8}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskReward}>
                  {tasksDone.has(item.id) ? '✓ Feito' : `+${item.reward} 🪙`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Grade de Apps */}
          <Text style={styles.sectionTitle}>Apps</Text>
          <AppGrid
            apps={permittedApps}
            tokens={tokens}
            unlocks={unlocks}
            onUnlockRequest={handleUnlockRequest}
            onAppPress={handleAppPress}
          />

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
          onPressIn={() => setSosHold(true)}
          onPressOut={() => setSosHold(false)}>
          <Text style={styles.sosText}>
            {sosHold ? 'Solte para enviar' : 'Segure 3s'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  gradient: {flex: 1},
  scroll: {flex: 1},
  scrollContent: {
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
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
    borderRadius: 28,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
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
  tasksScroll: {marginBottom: Spacing.lg},
  taskCard: {
    backgroundColor: Colors.childCard,
    borderRadius: 20,
    padding: Spacing.lg,
    width: 160,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
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
