/**
 * Configuração DNS - Child-friendly Professional
 */

import React from 'react';
import {
  Linking,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {NativeModules} from 'react-native';

import {DNS_PROFILES, type DnsMode} from '../../services/dnsProfiles';
import {Colors, Spacing, BorderRadius} from '../../theme/colors';

const {AppBlockModule, VpnModule} = NativeModules as any;

type DnsToggleProps = {
  dnsMode: DnsMode;
  onDnsModeChange: (v: DnsMode) => void;
  selectedProfileId: string;
  onSelectProfile: (id: string) => void;
  useCustom: boolean;
  onUseCustomChange: (v: boolean) => void;
  customDotHost: string;
  onCustomDotHostChange: (v: string) => void;
  customDohUrl: string;
  onCustomDohUrlChange: (v: string) => void;
  onApply: () => void;
};

export default function DnsToggle({
  dnsMode,
  onDnsModeChange,
  selectedProfileId,
  onSelectProfile,
  useCustom,
  onUseCustomChange,
  customDotHost,
  onCustomDotHostChange,
  customDohUrl,
  onCustomDohUrlChange,
  onApply,
}: DnsToggleProps): React.JSX.Element {
  const openNetworkSettings = () =>
    AppBlockModule?.openNetworkSettings?.()?.catch?.(() => Linking.openSettings());

  return (
    <View style={styles.section}>
      <Text style={styles.para}>
        Modo leve usa DNS Privado nativo (DoT). Modo avançado aplica fallback
        local.
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>Modo leve (DoT nativo)</Text>
        <Switch
          value={dnsMode === 'light'}
          onValueChange={v => onDnsModeChange(v ? 'light' : 'advanced')}
          trackColor={{false: '#CBD5E1', true: Colors.mintLight}}
          thumbColor={dnsMode === 'light' ? Colors.mint : '#64748B'}
        />
      </View>
      <TouchableOpacity style={styles.btnMuted} onPress={openNetworkSettings}>
        <Text style={styles.btnMutedText}>Abrir configurações de rede</Text>
      </TouchableOpacity>
      <Text style={styles.smallTitle}>Perfis DNS</Text>
      {DNS_PROFILES.map(profile => (
        <TouchableOpacity
          key={profile.id}
          style={[styles.card, selectedProfileId === profile.id && styles.cardSelected]}
          onPress={() => {
            onSelectProfile(profile.id);
            onUseCustomChange(false);
          }}>
          <Text style={styles.cardTitle}>{profile.name}</Text>
          <Text style={styles.cardDesc}>{profile.description}</Text>
          <Text style={styles.cardHint}>DoT: {profile.dotHost}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.row}>
        <Text style={styles.label}>Usar host customizado</Text>
        <Switch
          value={useCustom}
          onValueChange={onUseCustomChange}
          trackColor={{false: '#CBD5E1', true: Colors.mintLight}}
          thumbColor={useCustom ? Colors.mint : '#64748B'}
        />
      </View>
      {useCustom && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Host DoT custom (ex: dns.exemplo.com)"
            placeholderTextColor={Colors.textMuted}
            value={customDotHost}
            onChangeText={onCustomDotHostChange}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="URL DoH custom (opcional)"
            placeholderTextColor={Colors.textMuted}
            value={customDohUrl}
            onChangeText={onCustomDohUrlChange}
            autoCapitalize="none"
          />
        </>
      )}
      <TouchableOpacity style={styles.btn} onPress={onApply}>
        <Text style={styles.btnText}>Aplicar perfil DNS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {},
  para: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  label: {
    fontSize: 16,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.md,
    fontWeight: '500',
  },
  btnMuted: {
    backgroundColor: Colors.border,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  btnMutedText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  smallTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cardHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  btn: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
