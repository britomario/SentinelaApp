import React, {useCallback, useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BadgeCheck, HeartPulse, ShieldCheck} from 'lucide-react-native';

import {completeOnboarding, LinkedProvider} from '../services/onboardingState';
import {useToast} from '../components/feedback/ToastProvider';
import {getChildPairingConfig} from '../services/pairingService';
import {signInWithProvider} from '../services/authService';
import {captureHandledError} from '../services/observability/sentry';

type RootStackParamList = {
  Welcome: undefined;
  PinSetup: undefined;
  Main: undefined;
};

export default function WelcomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Welcome'>>();
  const {showToast} = useToast();
  const [busy, setBusy] = useState<LinkedProvider | null>(null);
  const [pairTokenPreview, setPairTokenPreview] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getChildPairingConfig().then(config => {
        if (config) {
          setPairTokenPreview(config.pairToken.slice(0, 8));
        } else {
          setPairTokenPreview(null);
        }
      });
    }, []),
  );

  const linkAccount = async (provider: LinkedProvider) => {
    setBusy(provider);
    await new Promise(resolve => setTimeout(resolve, 350));
    if (provider !== 'manual') {
      try {
        await signInWithProvider(provider);
      } catch (error) {
        captureHandledError(error, 'welcome_oauth');
        showToast({
          kind: 'info',
          title: 'Login social indisponivel',
          message: 'Continuando com vinculo local no dispositivo.',
        });
      }
    }
    await completeOnboarding(provider);
    showToast({
      kind: 'success',
      title: 'Conta vinculada',
      message: 'Agora vamos proteger o app com um PIN.',
    });
    navigation.replace('PinSetup');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.content}>
        <View style={styles.heroIconWrap}>
          <ShieldCheck color="#E2E8F0" size={42} />
        </View>
        <Text style={styles.title}>Bem-vindo ao Sentinela</Text>
        <Text style={styles.subtitle}>
          Segurança digital para crianças com controle parental simples, acolhedor e eficiente.
        </Text>
        <View style={styles.referencesRow}>
          <View style={styles.referencePill}>
            <HeartPulse size={14} color="#93C5FD" />
            <Text style={styles.referenceText}>Referências OMS/AAP</Text>
          </View>
          <View style={styles.referencePill}>
            <BadgeCheck size={14} color="#86EFAC" />
            <Text style={styles.referenceText}>Boas práticas clínicas</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => linkAccount('google')}
          disabled={!!busy}>
          <Text style={styles.primaryText}>
            {busy === 'google' ? 'Conectando...' : 'Vincular com Google'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => linkAccount('apple')}
          disabled={!!busy}>
          <Text style={styles.secondaryText}>
            {busy === 'apple' ? 'Conectando...' : 'Vincular com Apple'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => linkAccount('manual')}
          disabled={!!busy}>
          <Text style={styles.linkText}>Continuar sem login por enquanto</Text>
        </TouchableOpacity>

        <View style={styles.privacyBadge}>
          <View style={styles.privacyIconWrap}>
            <ShieldCheck size={18} color="#E2E8F0" />
          </View>
          <Text style={styles.privacyTitle}>Privacidade Garantida</Text>
          <Text style={styles.privacyText}>
            Sua privacidade é nossa prioridade. Todos os dados são criptografados de ponta a ponta. Nem mesmo nós, os desenvolvedores, temos acesso ao conteúdo monitorado.
          </Text>
          {!!pairTokenPreview && (
            <Text style={styles.pairingText}>Pareamento ativo (token {pairTokenPreview}...)</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heroIconWrap: {
    alignSelf: 'center',
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30,41,59,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#E2E8F0',
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },
  referencesRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  referencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.82)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  referenceText: {
    marginLeft: 6,
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 28,
    backgroundColor: '#0066CC',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  privacyBadge: {
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  privacyIconWrap: {
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyTitle: {
    marginTop: 8,
    color: '#E2E8F0',
    textAlign: 'center',
    fontWeight: '800',
  },
  privacyText: {
    marginTop: 6,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 12,
  },
  pairingText: {
    marginTop: 8,
    color: '#86EFAC',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
  },
});
