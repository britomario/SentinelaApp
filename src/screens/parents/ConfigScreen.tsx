/**
 * Configurações - DNS e Apps (Child-Friendly Professional)
 * Sem Escudo - foco em Proteção de Rede e Controle de Apps
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  AppState,
  DeviceEventEmitter,
  NativeModules,
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
import DnsToggle from '../../components/settings/DnsToggle';
import PinGate from '../../components/security/PinGate';
import {useToast} from '../../components/feedback/ToastProvider';
import {useReviewPrompt} from '../../components/feedback/ReviewPromptProvider';
import {useChildTasks} from '../../hooks/useChildTasks';
import {syncAppPolicyToSupabase} from '../../services/appPolicySyncService';
import {getEnv} from '../../services/config/env';
import {getCurrentChildId} from '../../services/currentChildService';
import {encryptAndStoreMonitoringEvent} from '../../security/monitoringVault';
import {DNS_PROFILES, type DnsMode, getDnsProfile} from '../../services/dnsProfiles';
import {syncDnsPolicyForChild} from '../../services/dnsPolicyService';
import {resolveDomainWithDoh} from '../../services/dohEngineService';
import {
  addDomainToList,
  getManualDomainLists,
  removeDomainFromList,
} from '../../services/manualDomainListService';
import {
  activateShield,
  deactivateShield,
  setShieldProfile,
  syncBlacklistToShield,
} from '../../services/shieldService';
import {Colors, Spacing, BorderRadius} from '../../theme/colors';
import {useShieldStatus} from '../../hooks/useShieldStatus';

const {AppBlockModule, VpnModule} = NativeModules as any;
const DNS_APPLIED_KEY = '@sentinela/dns_protection_applied';
type DnsValidationState = 'idle' | 'checking' | 'verified' | 'failed';

type ConfigTab = 'dns' | 'apps' | 'tasks' | 'manual';

export default function ConfigScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const {showToast} = useToast();
  const {recordReviewSignal} = useReviewPrompt();
  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    removeTask,
  } = useChildTasks();
  const [tab, setTab] = useState<ConfigTab>('dns');
  const [taskModal, setTaskModal] = useState<'new' | { id: string; title: string; reward: number } | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskReward, setTaskReward] = useState('50');
  const [pinGateVisible, setPinGateVisible] = useState(false);
  const pendingPinActionRef = useRef<() => void | Promise<void>>(() => {});
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [blockingEnabled, setBlockingEnabled] = useState(false);
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [antiTampering, setAntiTampering] = useState(true);

  const [dnsMode, setDnsMode] = useState<DnsMode>('light');
  const [selectedProfileId, setSelectedProfileId] = useState(DNS_PROFILES[0].id);
  const [useCustom, setUseCustom] = useState(false);
  const [dnsProtectionApplied, setDnsProtectionApplied] = useState(false);
  const [customDotHost, setCustomDotHost] = useState('');
  const [customDohUrl, setCustomDohUrl] = useState('');
  const [dnsValidationState, setDnsValidationState] = useState<DnsValidationState>('idle');
  const [dnsValidationMessage, setDnsValidationMessage] = useState('');
  const [childId, setChildId] = useState<string>('local-child');
  const [manualDomainInput, setManualDomainInput] = useState('');
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
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
    AsyncStorage.getItem(DNS_APPLIED_KEY).then(v => setDnsProtectionApplied(v === '1')).catch(() => {});
  }, []);

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
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const incomingTab = route.params?.initialTab as ConfigTab | undefined;
    if (!incomingTab) {
      return;
    }
    if (incomingTab === 'dns' || incomingTab === 'apps' || incomingTab === 'tasks' || incomingTab === 'manual') {
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

  const toggleBlocking = (v: boolean) => {
    executeWithPin(() => {
      AppBlockModule?.setBlockingEnabled?.(v)?.then?.(() => {
        setBlockingEnabled(v);
        showToast({
          kind: 'success',
          title: v ? 'Bloqueio de apps ativo' : 'Bloqueio de apps inativo',
        });
      })?.catch?.(() =>
        showToast({kind: 'error', title: 'Falha ao alterar bloqueio'}),
      );
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

  const isZeroIpAnswer = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized === '0.0.0.0' || normalized === '::';
  };

  const validateDnsProtection = async (
    profile: ReturnType<typeof getDnsProfile> & {dotHost: string; dohUrl?: string},
  ): Promise<{ok: boolean; message: string}> => {
    const blockedDomain =
      getEnv('DNS_VALIDATION_BLOCKED_DOMAIN')?.trim() || 'pornhub.com';
    if (!profile.dohUrl) {
      return {
        ok: false,
        message: 'Perfil sem URL DoH para validação automática.',
      };
    }

    const dohCheck = await resolveDomainWithDoh(profile.dohUrl, blockedDomain);
    const blockedByDoh =
      dohCheck.blocked || dohCheck.answers.some(answer => isZeroIpAnswer(answer));

    let nextDnsCheck = false;
    if (profile.provider === 'nextdns') {
      try {
        const response = await fetch('https://test.nextdns.io');
        const payload = await response.json().catch(() => ({} as Record<string, unknown>));
        nextDnsCheck =
          response.ok &&
          Boolean(
            payload &&
              typeof payload === 'object' &&
              (payload as {status?: string}).status === 'ok',
          );
      } catch {
        nextDnsCheck = false;
      }
    } else {
      nextDnsCheck = true;
    }

    if (blockedByDoh && nextDnsCheck) {
      return {
        ok: true,
        message: 'Proteção validada com bloqueio de categoria e rota DNS ativa.',
      };
    }
    return {
      ok: false,
      message:
        'Configuração aplicada, mas validação incompleta. Verifique DNS Privado e política NextDNS.',
    };
  };

  const applyDnsConfig = async () => {
    const profile = getDnsProfile(selectedProfileId);
    const dotHost = useCustom ? customDotHost.trim() : profile.dotHost;
    const dohUrl = useCustom ? customDohUrl.trim() : profile.dohUrl ?? '';

    if (!dotHost) {
      showToast({kind: 'error', title: 'Host DoT obrigatório'});
      return;
    }

    const syncedProfile = await syncDnsPolicyForChild(childId, {
      ...profile,
      dotHost,
      dohUrl,
    });

    await setShieldProfile({
      id: syncedProfile.id,
      name: syncedProfile.name,
      provider: syncedProfile.provider,
      dotHost: syncedProfile.dotHost,
      dohUrl: syncedProfile.dohUrl,
      fallbackDnsIp: syncedProfile.fallbackDnsIp,
    });
    if (shieldStatus.enabled) {
      await activateShield().catch(() => undefined);
      await refreshShieldStatus();
    }

    // Sem VPN: abre configurações de DNS Privado e copia hostname para clipboard
    await AppBlockModule?.copyToClipboard?.(dotHost)?.catch?.(() => undefined);
    await VpnModule?.openPrivateDnsSettings?.();
    setDnsValidationState('checking');
    setDnsValidationMessage('Validando proteção...');
    const validation = await validateDnsProtection(syncedProfile as typeof syncedProfile & {dotHost: string; dohUrl?: string});
    await AsyncStorage.setItem(DNS_APPLIED_KEY, validation.ok ? '1' : '0');
    setDnsProtectionApplied(validation.ok);
    setDnsValidationState(validation.ok ? 'verified' : 'failed');
    setDnsValidationMessage(validation.message);
    showToast(
      validation.ok
        ? {
            kind: 'success',
            title: 'Proteção DNS validada',
            message: `Host ${dotHost} ativo e filtrando categorias.`,
          }
        : {
            kind: 'info',
            title: 'DNS configurado',
            message:
              `Host ${dotHost} copiado, mas falta validação completa. Revise o DNS Privado nas configurações.`,
          },
    );
    recordReviewSignal('dns_private_configured').catch(() => undefined);
  };

  const protectionActive = shieldStatus.enabled && shieldStatus.vpnActive;
  const statusLabel = protectionActive ? 'Proteção Ativa' : 'Proteção Pausada';

  const toggleShieldProtection = async (enabled: boolean) => {
    if (isShieldLoading) {
      return;
    }
    setIsShieldLoading(true);
    try {
      let result;
      if (enabled) {
        result = await activateShield();
      } else {
        result = await deactivateShield();
      }
      await refreshShieldStatus();
      if (enabled && !result?.enabled) {
        showToast({
          kind: 'info',
          title: 'Escudo indisponível neste dispositivo',
          message: 'A proteção de rede nativa não está disponível neste sistema.',
        });
        return;
      }
      showToast({
        kind: 'success',
        title: enabled ? 'Escudo ativado' : 'Escudo pausado',
      });
    } catch (error) {
      console.error('[Config] Shield toggle failed', {
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

  const addDomain = async (target: 'blacklist' | 'whitelist') => {
    if (!manualDomainInput.trim()) {
      showToast({kind: 'info', title: 'Digite um domínio válido'});
      return;
    }
    const lists = await addDomainToList(manualDomainInput, target);
    setBlacklist(lists.blacklist);
    setWhitelist(lists.whitelist);
    setManualDomainInput('');
    await syncBlacklistToShield();
  };

  const removeDomain = async (target: 'blacklist' | 'whitelist', domain: string) => {
    const lists = await removeDomainFromList(domain, target);
    setBlacklist(lists.blacklist);
    setWhitelist(lists.whitelist);
    await syncBlacklistToShield();
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
            onValueChange={toggleShieldProtection}
            disabled={isShieldLoading}
            trackColor={{false: '#FCA5A5', true: '#67E8F9'}}
            thumbColor={protectionActive ? '#0EA5E9' : '#F97316'}
          />
          {isShieldLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        </View>
      </View>

      <View style={styles.tabs}>
        {(['dns', 'apps', 'tasks', 'manual'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'dns'
                ? 'DNS'
                : t === 'apps'
                  ? 'Apps'
                  : t === 'tasks'
                    ? 'Tarefas'
                    : 'Manual'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {tab === 'dns' && (
          <>
            <DnsToggle
              dnsMode={dnsMode}
              onDnsModeChange={setDnsMode}
              selectedProfileId={selectedProfileId}
              onSelectProfile={setSelectedProfileId}
              dnsProtectionApplied={dnsProtectionApplied}
              useCustom={useCustom}
              onUseCustomChange={setUseCustom}
              customDotHost={customDotHost}
              onCustomDotHostChange={setCustomDotHost}
              customDohUrl={customDohUrl}
              onCustomDohUrlChange={setCustomDohUrl}
              onApply={applyDnsConfig}
            />
            {dnsValidationState !== 'idle' && (
              <View style={[styles.validationCard, dnsValidationState === 'verified' ? styles.validationCardOk : styles.validationCardWarn]}>
                <Text style={[styles.validationTitle, dnsValidationState === 'verified' ? styles.validationTitleOk : styles.validationTitleWarn]}>
                  {dnsValidationState === 'checking'
                    ? 'Validando proteção...'
                    : dnsValidationState === 'verified'
                      ? 'Proteção confirmada'
                      : 'Validação pendente'}
                </Text>
                <Text style={styles.validationDesc}>{dnsValidationMessage}</Text>
              </View>
            )}
          </>
        )}

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
            <Text style={styles.tasksSectionTitle}>Bloqueio manual</Text>
            <Text style={styles.tasksSectionDesc}>
              Adicione domínios específicos na lista negra ou branca.
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
          </View>
        )}

        {tab === 'apps' && (
          <View style={styles.section}>
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
        onClose={() => setPinGateVisible(false)}
        onSuccess={onPinSuccess}
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
