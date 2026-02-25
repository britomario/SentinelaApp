/**
 * Configurações - DNS e Apps (Child-Friendly Professional)
 * Sem Escudo - foco em Proteção de Rede e Controle de Apps
 */

import React, {useCallback, useEffect, useState} from 'react';
import {
  DeviceEventEmitter,
  NativeModules,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AppList from '../../components/settings/AppList';
import DnsToggle from '../../components/settings/DnsToggle';
import {useToast} from '../../components/feedback/ToastProvider';
import {useReviewPrompt} from '../../components/feedback/ReviewPromptProvider';
import {syncAppPolicyToSupabase} from '../../services/appPolicySyncService';
import {encryptAndStoreMonitoringEvent} from '../../security/monitoringVault';
import {DNS_PROFILES, type DnsMode, getDnsProfile} from '../../services/dnsProfiles';
import {syncDnsPolicyForChild} from '../../services/dnsPolicyService';
import {resolveDomainWithDoh} from '../../services/dohEngineService';
import {Colors, Spacing} from '../../theme/colors';

const {AppBlockModule, VpnModule} = NativeModules as any;

type ConfigTab = 'dns' | 'apps';

export default function ConfigScreen(): React.JSX.Element {
  const {showToast} = useToast();
  const {recordReviewSignal} = useReviewPrompt();
  const [tab, setTab] = useState<ConfigTab>('dns');
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [blockingEnabled, setBlockingEnabled] = useState(false);
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [antiTampering, setAntiTampering] = useState(true);

  const [dnsMode, setDnsMode] = useState<DnsMode>('light');
  const [selectedProfileId, setSelectedProfileId] = useState(DNS_PROFILES[0].id);
  const [useCustom, setUseCustom] = useState(false);
  const [customDotHost, setCustomDotHost] = useState('');
  const [customDohUrl, setCustomDohUrl] = useState('');

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

  const toggleBlocking = (v: boolean) => {
    AppBlockModule?.setBlockingEnabled?.(v)?.then?.(() => {
      setBlockingEnabled(v);
      showToast({
        kind: 'success',
        title: v ? 'Bloqueio de apps ativo' : 'Bloqueio de apps inativo',
      });
    })?.catch?.(() =>
      showToast({kind: 'error', title: 'Falha ao alterar bloqueio'}),
    );
  };

  const toggleApp = (pkg: string) => {
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
  };

  const applyDnsConfig = async () => {
    const profile = getDnsProfile(selectedProfileId);
    const dotHost = useCustom ? customDotHost.trim() : profile.dotHost;
    const dohUrl = useCustom ? customDohUrl.trim() : profile.dohUrl ?? '';
    const fallbackDnsIp = profile.fallbackDnsIp;

    if (!dotHost) {
      showToast({kind: 'error', title: 'Host DoT obrigatório'});
      return;
    }

    const syncedProfile = await syncDnsPolicyForChild('mock-child-id', {
      ...profile,
      dotHost,
      dohUrl,
    });

    if (dnsMode === 'light') {
      await VpnModule?.openPrivateDnsSettings?.();
      showToast({
        kind: 'info',
        title: 'Configure DNS Privado no Android',
        message: `Use o host: ${dotHost} (${syncedProfile.provider})`,
      });
      recordReviewSignal('dns_private_configured').catch(() => undefined);
      return;
    }

    await VpnModule?.setUpstreamDns?.(fallbackDnsIp);
    showToast({
      kind: 'success',
      title: 'Camada avançada configurada',
      message: `DNS upstream ${fallbackDnsIp} aplicado.`,
    });
    recordReviewSignal('dns_private_configured').catch(() => undefined);
  };

  const protectionActive = blockingEnabled && antiTampering;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
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
            {protectionActive ? 'Conectado e Seguro' : 'Proteção Pausada'}
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['dns', 'apps'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'dns' ? 'DNS' : 'Apps'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {tab === 'dns' && (
          <DnsToggle
            dnsMode={dnsMode}
            onDnsModeChange={setDnsMode}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
            useCustom={useCustom}
            onUseCustomChange={setUseCustom}
            customDotHost={customDotHost}
            onCustomDotHostChange={setCustomDotHost}
            customDohUrl={customDohUrl}
            onCustomDohUrlChange={setCustomDohUrl}
            onApply={applyDnsConfig}
          />
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
                  onPress={() => AppBlockModule?.openAccessibilitySettings?.()}>
                  <Text style={styles.btnText}>Abrir configurações</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
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
    borderColor: Colors.mint,
    backgroundColor: Colors.mintLight,
  },
  statusPillPaused: {
    borderColor: Colors.childAmber,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusDotActive: {backgroundColor: Colors.mint},
  statusDotPaused: {backgroundColor: Colors.childAmber},
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusTextActive: {color: Colors.mint},
  statusTextPaused: {color: Colors.childAmber},

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
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
    fontSize: 15,
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
});
