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
        <Text style={styles.hero}>🛡️👨‍👩‍👧</Text>
        <Text style={styles.title}>Bem-vindo ao Sentinela</Text>
        <Text style={styles.subtitle}>
          Segurança digital para crianças com controle parental simples, acolhedor e eficiente.
        </Text>
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
          <Text style={styles.privacyIcon}>🛡️🔒</Text>
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
  hero: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 10,
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
  privacyIcon: {
    textAlign: 'center',
    fontSize: 20,
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
