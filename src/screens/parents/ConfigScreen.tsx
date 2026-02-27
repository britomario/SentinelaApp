/**
 * Configurações - DNS e Apps (Child-Friendly Professional)
 * Sem Escudo - foco em Proteção de Rede e Controle de Apps
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  DeviceEventEmitter,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import {useRoute} from '@react-navigation/native';

import AppList from '../../components/settings/AppList';
import PinGate from '../../components/security/PinGate';
import {useToast} from '../../components/feedback/ToastProvider';
import {useChildTasks} from '../../hooks/useChildTasks';
import {syncAppPolicyToSupabase} from '../../services/appPolicySyncService';
import {getCurrentChildId} from '../../services/currentChildService';
import {encryptAndStoreMonitoringEvent} from '../../security/monitoringVault';
import {
  getSyncStatus,
  syncBlacklist,
} from '../../services/blacklistSyncService';
import {
  addDomainToList,
  addKeyword,
  getManualDomainLists,
  removeDomainFromList,
  removeKeyword,
} from '../../services/manualDomainListService';
import {
  activateShield,
  deactivateShield,
  getShieldErrorMessage,
  syncBlacklistToShield,
} from '../../services/shieldService';
import {Colors, Spacing, BorderRadius} from '../../theme/colors';
import {useShieldStatus} from '../../hooks/useShieldStatus';

const {AppBlockModule} = NativeModules as any;

function formatHoursAgo(ms: number): string {
  const h = Math.floor((Date.now() - ms) / 3600000);
  if (h < 1) {return 'menos de 1 hora';}
  if (h === 1) {return '1 hora';}
  return `${h} horas`;
}
type ConfigTab = 'apps' | 'tasks' | 'manual';

export default function ConfigScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const {showToast} = useToast();
  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    removeTask,
  } = useChildTasks();
  const [tab, setTab] = useState<ConfigTab>('apps');
  const [taskModal, setTaskModal] = useState<'new' | { id: string; title: string; reward: number } | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskReward, setTaskReward] = useState('50');
  const [pinGateVisible, setPinGateVisible] = useState(false);
  const pendingPinActionRef = useRef<() => void | Promise<void>>(() => {});
  const pendingShieldPinActionRef = useRef<((pin: string) => Promise<void>) | null>(null);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [blockingEnabled, setBlockingEnabled] = useState(false);
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [antiTampering, setAntiTampering] = useState(true);

  const [_childId, setChildId] = useState<string>('local-child');
  const [manualDomainInput, setManualDomainInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<{lastSyncAt: number | null; totalBlocked: number}>({
    lastSyncAt: null,
    totalBlocked: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [isShieldLoading, setIsShieldLoading] = useState(false);
  const justOpenedAccessibilityRef = useRef<number>(0);
  const {shieldStatus, refreshShieldStatus} = useShieldStatus();

  const refreshBlockingStatus = useCallback(() => {
    AppBlockModule?.isAccessibilityEnabled?.()
      ?.then?.((v: boolean) => setAccessibilityEnabled(!!v))
      ?.catch?.(() => {});
    AppBlockModule?.isBlockingEnabled?.()
      ?.then?.((v: boolean) => setBlockingEnabled(!!v))
      ?.catch?.(() => {});
    AppBlockModule?.getBlockedApps?.()
      ?.then?.((arr: string[]) => setBlockedApps(new Set(arr || [])))
      ?.catch?.(() => {});
    AppBlockModule?.isAntiTamperingEnabled?.()
      ?.then?.((v: boolean) => setAntiTampering(!!v))
      ?.catch?.(() => {});
  }, []);

  useEffect(() => {
    setBlockingEnabled(shieldStatus.enabled);
  }, [shieldStatus.enabled]);

  useEffect(() => {
    getCurrentChildId()
      .then(id => setChildId(id))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    getManualDomainLists()
      .then(lists => {
        setBlacklist(lists.blacklist);
        setWhitelist(lists.whitelist);
        setKeywords(lists.keywords);
      })
      .catch(() => undefined);
    getSyncStatus().then(s => setSyncStatus({
      lastSyncAt: s.lastSyncAt,
      totalBlocked: s.totalBlocked,
    })).catch(() => undefined);
  }, []);

  useEffect(() => {
    const incomingTab = route.params?.initialTab as ConfigTab | undefined;
    if (!incomingTab) {
      return;
    }
    if (incomingTab === 'apps' || incomingTab === 'tasks' || incomingTab === 'manual') {
      setTab(incomingTab);
    }
  }, [route.params?.initialTab]);

  useEffect(() => {
    refreshBlockingStatus();
    const sub = DeviceEventEmitter.addListener(
      'onDomainBlocked',
      (e: {domain: string}) => {
        encryptAndStoreMonitoringEvent({
          type: 'domain_blocked',
          domain: e.domain,
          timestamp: Date.now(),
        }).catch(() => undefined);
      },
    );
    return () => sub.remove();
  }, [refreshBlockingStatus]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        const openedAt = justOpenedAccessibilityRef.current;
        if (openedAt && Date.now() - openedAt < 5000) {
          setTimeout(refreshBlockingStatus, 2500);
        } else {
          refreshBlockingStatus();
        }
      }
    });
    return () => sub.remove();
  }, [refreshBlockingStatus]);

  const executeWithPin = (action: () => void | Promise<void>) => {
    const run = async () => {
      try {
        const hasPin = await (NativeModules as any).SecurityModule?.hasSecurityPin?.();
        if (!hasPin) {
          await action();
          return;
        }
      } catch {
        // Fallback to gate
      }
      pendingPinActionRef.current = action;
      setPinGateVisible(true);
    };
    run();
  };

  const onPinSuccess = async () => {
    const action = pendingPinActionRef.current;
    if (action) {
      await action();
    }
  };

  const onPinSuccessWithPin = async (pin: string) => {
    const action = pendingShieldPinActionRef.current;
    if (action) {
      try {
        await action(pin);
      } finally {
        pendingShieldPinActionRef.current = null;
      }
    }
  };

  const executeWithPinForShield = (enabled: boolean) => {
    const runShieldToggle = async (pin: string) => {
      setIsShieldLoading(true);
      try {
        let result;
        if (enabled) {
          result = await activateShield(pin);
        } else {
          result = await deactivateShield(pin);
        }
        await refreshShieldStatus();
        if (enabled && !result?.enabled) {
          showToast({
            kind: 'info',
            title: 'Bloqueio indisponível',
            message: 'Ative o serviço de acessibilidade para bloquear conteúdo.',
          });
          return;
        }
        showToast({
          kind: 'success',
          title: enabled ? 'Escudo ativado' : 'Escudo pausado',
        });
      } catch (error) {
        console.error('[Config] Shield toggle failed', {enabled, error});
        const msg = getShieldErrorMessage(error);
        showToast({
          kind: 'error',
          title: enabled ? 'Não foi possível ativar o Escudo' : 'Não foi possível pausar o Escudo',
          message: msg,
        });
      } finally {
        setIsShieldLoading(false);
      }
    };

    const doIt = async () => {
      if (enabled && Platform.OS === 'android' && !accessibilityEnabled) {
        showToast({
          kind: 'warning',
          title: 'Serviço de acessibilidade necessário',
          message:
            'Ative o Sentinela em Acessibilidade para bloquear sites e apps. Abrindo configurações...',
        });
        AppBlockModule?.openAccessibilitySettings?.();
        return;
      }
      try {
        const hasPin = await (NativeModules as any).SecurityModule?.hasSecurityPin?.();
        if (!hasPin) {
          await runShieldToggle('');
          return;
        }
      } catch {
        // Fallback to gate
      }
      pendingShieldPinActionRef.current = runShieldToggle;
      setPinGateVisible(true);
    };
    if (isShieldLoading) {
      return;
    }
    doIt();
  };

  const toggleBlocking = (_v: boolean) => {
    showToast({
      kind: 'info',
      title: 'Bloqueio unificado',
      message: 'O bloqueio de sites e apps segue o switch de Proteção acima.',
    });
  };

  const toggleApp = (pkg: string) => {
    executeWithPin(() => {
      const next = new Set(blockedApps);
      if (next.has(pkg)) {
        next.delete(pkg);
      } else {
        next.add(pkg);
      }
      setBlockedApps(next);
      const arr = Array.from(next);
      AppBlockModule?.setBlockedApps?.(arr)?.catch?.(() => undefined);
      syncAppPolicyToSupabase(arr).catch(() => undefined);
    });
  };

  const protectionActive = shieldStatus.enabled;
  const statusLabel = protectionActive ? 'Proteção Ativa' : 'Proteção Pausada';

  const applyManualListChange = useCallback(async () => {
    await syncBlacklistToShield();
    await refreshShieldStatus();
    getSyncStatus()
      .then(s =>
        setSyncStatus({lastSyncAt: s.lastSyncAt, totalBlocked: s.totalBlocked}),
      )
      .catch(() => undefined);
  }, [refreshShieldStatus]);

  const addDomain = async (target: 'blacklist' | 'whitelist') => {
    if (!manualDomainInput.trim()) {
      showToast({kind: 'info', title: 'Digite um domínio válido'});
      return;
    }
    const lists = await addDomainToList(manualDomainInput, target);
    setBlacklist(lists.blacklist);
    setWhitelist(lists.whitelist);
    setManualDomainInput('');
    await applyManualListChange();
  };

  const removeDomain = async (target: 'blacklist' | 'whitelist', domain: string) => {
    const lists = await removeDomainFromList(domain, target);
    setBlacklist(lists.blacklist);
    setWhitelist(lists.whitelist);
    await applyManualListChange();
  };

  const addKeywordToList = async () => {
    if (!keywordInput.trim()) {
      showToast({kind: 'info', title: 'Digite uma palavra-chave'});
      return;
    }
    const lists = await addKeyword(keywordInput);
    setKeywords(lists.keywords);
    setKeywordInput('');
    await applyManualListChange();
  };

  const removeKeywordFromList = async (kw: string) => {
    const lists = await removeKeyword(kw);
    setKeywords(lists.keywords);
    await applyManualListChange();
  };

  const runManualSync = async () => {
    setSyncing(true);
    try {
      const status = await syncBlacklist();
      setSyncStatus({lastSyncAt: status.lastSyncAt, totalBlocked: status.totalBlocked});
      await syncBlacklistToShield();
      showToast({kind: 'success', title: 'Lista atualizada'});
    } catch {
      showToast({kind: 'error', title: 'Falha ao sincronizar'});
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
        <View style={styles.shieldRow}>
          <View
            style={[
              styles.statusPill,
              protectionActive ? styles.statusPillActive : styles.statusPillPaused,
            ]}>
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
              {statusLabel}
            </Text>
          </View>
          <Switch
            value={protectionActive}
            onValueChange={executeWithPinForShield}
            disabled={isShieldLoading}
            trackColor={{false: '#FCA5A5', true: '#67E8F9'}}
            thumbColor={protectionActive ? '#0EA5E9' : '#F97316'}
          />
          {isShieldLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        </View>
      </View>

      <View style={styles.tabs}>
        {(['apps', 'tasks', 'manual'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'apps' ? 'Apps' : t === 'tasks' ? 'Tarefas' : 'Manual'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {tab === 'tasks' && (
          <View style={styles.section}>
            <Text style={styles.tasksSectionTitle}>Tarefas com recompensa</Text>
            <Text style={styles.tasksSectionDesc}>
              Defina tarefas para a criança. Ao completar, ela ganha moedas (tokens).
            </Text>
            <TouchableOpacity
              style={styles.newTaskBtn}
              onPress={() => {
                setTaskModal('new');
                setTaskTitle('');
                setTaskReward('50');
              }}>
              <Text style={styles.newTaskBtnText}>+ Nova tarefa</Text>
            </TouchableOpacity>
            {tasksLoading ? (
              <Text style={styles.tasksLoading}>Carregando...</Text>
            ) : tasks.length === 0 ? (
              <Text style={styles.tasksEmpty}>Nenhuma tarefa. Crie uma para a criança ganhar tokens ao concluir.</Text>
            ) : (
              tasks.map(task => (
                <View key={task.id} style={styles.taskRow}>
                  <View style={styles.taskInfo}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskReward}>{task.rewardCoins} moedas</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.taskEditBtn}
                    onPress={() => {
                      setTaskModal({ id: task.id, title: task.title, reward: task.rewardCoins });
                      setTaskTitle(task.title);
                      setTaskReward(String(task.rewardCoins));
                    }}>
                    <Text style={styles.taskEditBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.taskDeleteBtn}
                    onPress={() => executeWithPin(async () => {
                      const ok = await removeTask(task.id);
                      showToast(ok ? { kind: 'success', title: 'Tarefa removida' } : { kind: 'error', title: 'Falha ao remover' });
                    })}>
                    <Text style={styles.taskDeleteBtnText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'manual' && (
          <View style={styles.section}>
            <View style={styles.manualStatusCard}>
              <Text style={styles.manualStatusTitle}>
                Lista de proteção
                {syncStatus.lastSyncAt
                  ? ` atualizada há ${formatHoursAgo(syncStatus.lastSyncAt)}`
                  : ' — sincronize para atualizar'}
              </Text>
              <Text style={styles.manualStatusCount}>
                {syncStatus.totalBlocked.toLocaleString('pt-BR')} sites bloqueados
              </Text>
              <TouchableOpacity
                style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
                onPress={runManualSync}
                disabled={syncing}>
                <Text style={styles.syncBtnText}>
                  {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tasksSectionTitle}>Bloqueio manual</Text>
            <Text style={styles.tasksSectionDesc}>
              Adicione domínios ou palavras-chave para bloquear.
            </Text>
            <View style={styles.manualInputWrap}>
              <TextInput
                style={styles.taskModalInput}
                placeholder="Ex: tiktok.com"
                placeholderTextColor={Colors.textMuted}
                value={manualDomainInput}
                onChangeText={setManualDomainInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.manualButtonsRow}>
                <TouchableOpacity
                  style={[styles.taskModalBtn, styles.manualBlacklistBtn]}
                  onPress={() => addDomain('blacklist')}>
                  <Text style={styles.manualBtnText}>Adicionar à Lista Negra</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.taskModalBtn, styles.manualWhitelistBtn]}
                  onPress={() => addDomain('whitelist')}>
                  <Text style={styles.manualBtnText}>Adicionar à Lista Branca</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.manualInputWrap}>
              <TextInput
                style={styles.taskModalInput}
                placeholder="Ex: apostas, casino"
                placeholderTextColor={Colors.textMuted}
                value={keywordInput}
                onChangeText={setKeywordInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.taskModalBtn, styles.manualBlacklistBtn]}
                onPress={addKeywordToList}>
                <Text style={styles.manualBtnText}>Adicionar palavra-chave</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.manualListCard}>
              <Text style={styles.manualListTitle}>Lista Negra</Text>
              {blacklist.length === 0 ? (
                <Text style={styles.tasksEmpty}>Sem domínios adicionados.</Text>
              ) : (
                blacklist.map(domain => (
                  <View key={`black-${domain}`} style={styles.manualItemRow}>
                    <Text style={styles.manualItemText}>{domain}</Text>
                    <TouchableOpacity onPress={() => removeDomain('blacklist', domain)}>
                      <Text style={styles.manualRemoveText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
            <View style={styles.manualListCard}>
              <Text style={styles.manualListTitle}>Lista Branca</Text>
              {whitelist.length === 0 ? (
                <Text style={styles.tasksEmpty}>Sem domínios adicionados.</Text>
              ) : (
                whitelist.map(domain => (
                  <View key={`white-${domain}`} style={styles.manualItemRow}>
                    <Text style={styles.manualItemText}>{domain}</Text>
                    <TouchableOpacity onPress={() => removeDomain('whitelist', domain)}>
                      <Text style={styles.manualRemoveText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
            <View style={styles.manualListCard}>
              <Text style={styles.manualListTitle}>Palavras-chave</Text>
              {keywords.length === 0 ? (
                <Text style={styles.tasksEmpty}>Sem palavras-chave adicionadas (usando padrão).</Text>
              ) : (
                keywords.map(kw => (
                  <View key={`kw-${kw}`} style={styles.manualItemRow}>
                    <Text style={styles.manualItemText}>{kw}</Text>
                    <TouchableOpacity onPress={() => removeKeywordFromList(kw)}>
                      <Text style={styles.manualRemoveText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {tab === 'apps' && (
          <View style={styles.section}>
            <Text style={styles.para}>
              O bloqueio de sites e apps segue o switch de Proteção acima.
            </Text>
            {accessibilityEnabled ? (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>
                    Proteger app e configurações sensíveis
                  </Text>
                  <Switch
                    value={antiTampering}
                    onValueChange={(v: boolean) => {
                      setAntiTampering(v);
                      AppBlockModule?.setAntiTamperingEnabled?.(v)?.catch?.(
                        () => undefined,
                      );
                    }}
                    trackColor={{false: '#CBD5E1', true: Colors.mintLight}}
                    thumbColor={antiTampering ? Colors.mint : '#64748B'}
                  />
                </View>
                <AppList
                  blockedApps={blockedApps}
                  blockingEnabled={blockingEnabled}
                  onToggleBlocking={toggleBlocking}
                  onToggleApp={toggleApp}
                  blockingSwitchDisabled
                />
              </>
            ) : (
              <>
                <Text style={styles.para}>
                  Ative o serviço de acessibilidade para bloquear apps.
                </Text>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => {
                    justOpenedAccessibilityRef.current = Date.now();
                    AppBlockModule?.openAccessibilitySettings?.();
                  }}>
                  <Text style={styles.btnText}>Abrir configurações</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Nova/Editar Tarefa */}
      <Modal visible={!!taskModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.taskModalCard}>
            <Text style={styles.taskModalTitle}>
              {taskModal === 'new' ? 'Nova tarefa' : 'Editar tarefa'}
            </Text>
            <TextInput
              style={styles.taskModalInput}
              placeholder="Nome da tarefa"
              placeholderTextColor={Colors.textMuted}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
            <TextInput
              style={styles.taskModalInput}
              placeholder="Recompensa (moedas)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              value={taskReward}
              onChangeText={setTaskReward}
            />
            <View style={styles.taskModalRow}>
              <TouchableOpacity
                style={[styles.taskModalBtn, styles.taskModalCancel]}
                onPress={() => setTaskModal(null)}>
                <Text style={styles.taskModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.taskModalBtn, styles.taskModalSave]}
                onPress={() => {
                  const title = taskTitle.trim();
                  const reward = parseInt(taskReward, 10) || 0;
                  if (!title) {
                    showToast({ kind: 'error', title: 'Digite o nome da tarefa' });
                    return;
                  }
                  executeWithPin(async () => {
                    const modal = taskModal;
                    if (modal === 'new') {
                      const created = await createTask(title, reward);
                      setTaskModal(null);
                      showToast(created ? { kind: 'success', title: 'Tarefa criada' } : { kind: 'error', title: 'Falha ao criar' });
                    } else if (modal && 'id' in modal) {
                      const ok = await updateTask(modal.id, title, reward);
                      setTaskModal(null);
                      showToast(ok ? { kind: 'success', title: 'Tarefa atualizada' } : { kind: 'error', title: 'Falha ao atualizar' });
                    }
                  });
                }}>
                <Text style={styles.taskModalSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PinGate
        visible={pinGateVisible}
        onClose={() => {
          setPinGateVisible(false);
          if (pendingShieldPinActionRef.current) {
            setIsShieldLoading(false);
            pendingShieldPinActionRef.current = null;
          }
        }}
        onSuccess={onPinSuccess}
        onSuccessWithPin={onPinSuccessWithPin}
        title="Digite o PIN para continuar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  shieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPillActive: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  statusPillPaused: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249,115,22,0.14)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusDotActive: {backgroundColor: '#22C55E'},
  statusDotPaused: {backgroundColor: '#F97316'},
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusTextActive: {color: '#16A34A'},
  statusTextPaused: {color: '#C2410C'},

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: Colors.white,
  },

  scroll: {flex: 1},
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 16,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.md,
    fontWeight: '500',
  },
  para: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  btn: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },

  tasksSectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  tasksSectionDesc: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },
  newTaskBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  newTaskBtnText: { color: Colors.white, fontWeight: '700' },
  tasksLoading: { color: Colors.textSecondary, marginBottom: Spacing.md },
  tasksEmpty: { color: Colors.textMuted, marginBottom: Spacing.md },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  taskTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  taskReward: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  taskInfo: { flex: 1 },
  taskEditBtn: { paddingHorizontal: Spacing.sm }, taskEditBtnText: { color: Colors.primary, fontWeight: '600' },
  taskDeleteBtn: { paddingHorizontal: Spacing.sm }, taskDeleteBtnText: { color: Colors.alert, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  taskModalCard: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.xl, width: '100%', maxWidth: 320 },
  taskModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },
  taskModalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  taskModalRow: { flexDirection: 'row', gap: Spacing.md },
  taskModalBtn: { flex: 1, padding: Spacing.md, borderRadius: 12, alignItems: 'center' },
  taskModalCancel: { backgroundColor: Colors.border },
  taskModalSave: { backgroundColor: Colors.primary },
  taskModalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  taskModalSaveText: { color: Colors.white, fontWeight: '700' },
  validationCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
  },
  validationCardOk: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.45)',
  },
  validationCardWarn: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.45)',
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  validationTitleOk: {
    color: '#059669',
  },
  validationTitleWarn: {
    color: '#B45309',
  },
  validationDesc: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  manualStatusCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manualStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  manualStatusCount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  syncBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: Colors.white, fontWeight: '700' },
  manualInputWrap: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  manualButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualBlacklistBtn: {
    backgroundColor: '#DC2626',
  },
  manualWhitelistBtn: {
    backgroundColor: '#059669',
  },
  manualBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  manualListCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  manualListTitle: {
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  manualItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  manualItemText: {
    color: Colors.textSecondary,
    flex: 1,
    marginRight: Spacing.md,
  },
  manualRemoveText: {
    fontSize: 18,
  },
});
