import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BadgeCheck, HeartPulse, ShieldCheck} from 'lucide-react-native';

import {completeOnboarding, LinkedProvider} from '../services/onboardingState';
import {useToast} from '../components/feedback/ToastProvider';
import {getChildPairingConfig} from '../services/pairingService';
import {
  completeAuthFromCallbackUrl,
  getAuthenticatedUserId,
  isAuthCallbackUrl,
  signInWithProvider,
  waitForAuthenticatedSession,
} from '../services/authService';
import {
  hasCloudLoginPin,
  upsertCloudLoginPin,
  verifyCloudLoginPin,
} from '../services/cloudLoginPinService';
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
  const [fallbackPin, setFallbackPin] = useState('');
  const [showFallbackPin, setShowFallbackPin] = useState(false);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [fallbackUserId, setFallbackUserId] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<LinkedProvider | null>(null);
  const [needsCloudPinSetup, setNeedsCloudPinSetup] = useState(false);
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      getChildPairingConfig().then(config => {
        if (config) {
          setPairTokenPreview(config.pairToken.slice(0, 8));
        } else {
          setPairTokenPreview(null);
        }
      });
      getAuthenticatedUserId()
        .then(setFallbackUserId)
        .catch(() => setFallbackUserId(null));
    }, []),
  );

  const clearOauthTimeout = () => {
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }
  };

  const completeLocalOnboarding = async (provider: LinkedProvider, title: string, message: string) => {
    await completeOnboarding(provider);
    showToast({
      kind: 'success',
      title,
      message,
    });
    navigation.replace('PinSetup');
  };

  const finalizeSocialAuth = async (provider: LinkedProvider) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return false;
    }
    setFallbackUserId(userId);
    const alreadyHasCloudPin = await hasCloudLoginPin(userId);
    if (!alreadyHasCloudPin) {
      setNeedsCloudPinSetup(true);
      setShowFallbackPin(true);
      setPendingProvider(provider);
      showToast({
        kind: 'info',
        title: 'Defina um PIN de contingência',
        message: 'Crie um PIN de 4 dígitos para fallback de login seguro.',
      });
      return false;
    }
    await completeLocalOnboarding(
      provider,
      'Conta vinculada',
      'Autenticação social concluída. Agora vamos proteger com PIN.',
    );
    return true;
  };

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!isAuthCallbackUrl(url)) {
        return;
      }
      const provider = pendingProvider;
      if (!provider || provider === 'manual') {
        return;
      }
      try {
        const completed = await completeAuthFromCallbackUrl(url);
        if (!completed) {
          throw new Error('oauth_callback_exchange_failed');
        }
        const hasSession = await waitForAuthenticatedSession(12000);
        if (!hasSession) {
          throw new Error('oauth_session_not_available');
        }
        clearOauthTimeout();
        setBusy(null);
        await finalizeSocialAuth(provider);
      } catch (error) {
        captureHandledError(error, 'welcome_oauth_callback');
        clearOauthTimeout();
        setBusy(null);
        setShowFallbackPin(true);
        showToast({
          kind: 'error',
          title: 'Falha no login social',
          message: 'Não foi possível validar sua sessão. Use o PIN de contingência.',
        });
      }
    };

    Linking.getInitialURL()
      .then(url => handleUrl(url).catch(() => undefined))
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => {
      handleUrl(event.url).catch(() => undefined);
    });
    return () => {
      clearOauthTimeout();
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run only on pendingProvider change; finalizeSocialAuth/showToast are stable callbacks used inside async handleUrl
  }, [pendingProvider]);

  const linkAccount = async (provider: LinkedProvider) => {
    setBusy(provider);
    await new Promise(resolve => setTimeout(resolve, 350));
    if (provider === 'manual') {
      await completeLocalOnboarding(
        'manual',
        'Modo local ativado',
        'Você pode configurar PIN local e vincular social depois.',
      );
      return;
    }
    try {
      const started = await signInWithProvider(provider);
      if (!started) {
        throw new Error('oauth_url_not_generated');
      }
      setPendingProvider(provider);
      clearOauthTimeout();
      oauthTimeoutRef.current = setTimeout(() => {
        setBusy(null);
        setShowFallbackPin(true);
        showToast({
          kind: 'info',
          title: 'Autenticação não concluída',
          message: 'Se cancelou o provedor social, use o PIN de contingência.',
        });
      }, 20000);
    } catch (error) {
      captureHandledError(error, 'welcome_oauth_start');
      clearOauthTimeout();
      setBusy(null);
      setShowFallbackPin(true);
      showToast({
        kind: 'error',
        title: 'Login social indisponível',
        message: 'Não foi possível iniciar o provedor. Use o PIN de contingência.',
      });
    }
  };

  const submitFallbackPin = async () => {
    if (!/^\d{4}$/.test(fallbackPin)) {
      showToast({
        kind: 'info',
        title: 'PIN inválido',
        message: 'Digite um PIN de 4 dígitos.',
      });
      return;
    }
    if (!fallbackUserId) {
      showToast({
        kind: 'error',
        title: 'Sessão ausente',
        message: 'Abra ao menos um login social para validar o PIN de fallback.',
      });
      return;
    }
    setFallbackBusy(true);
    try {
      if (needsCloudPinSetup) {
        const saved = await upsertCloudLoginPin(fallbackUserId, fallbackPin);
        if (!saved) {
          throw new Error('cloud_pin_upsert_failed');
        }
        const provider = pendingProvider && pendingProvider !== 'manual' ? pendingProvider : 'manual';
        await completeLocalOnboarding(
          provider,
          'PIN de contingência salvo',
          'Backup de login configurado com sucesso.',
        );
        return;
      }
      const ok = await verifyCloudLoginPin(fallbackUserId, fallbackPin);
      if (!ok) {
        showToast({
          kind: 'error',
          title: 'PIN incorreto',
          message: 'Confira o PIN de contingência e tente novamente.',
        });
        return;
      }
      await completeLocalOnboarding(
        'manual',
        'Fallback validado',
        'Acesso liberado via PIN de contingência.',
      );
    } catch (error) {
      captureHandledError(error, 'welcome_fallback_pin');
      showToast({
        kind: 'error',
        title: 'Falha no fallback',
        message: 'Não foi possível validar o PIN de contingência agora.',
      });
    } finally {
      setFallbackBusy(false);
    }
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
          style={styles.secondaryButton}
          onPress={() => linkAccount('facebook')}
          disabled={!!busy}>
          <Text style={styles.secondaryText}>
            {busy === 'facebook' ? 'Conectando...' : 'Vincular com Facebook'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => linkAccount('manual')}
          disabled={!!busy}>
          <Text style={styles.linkText}>Continuar sem login por enquanto</Text>
        </TouchableOpacity>

        {showFallbackPin && (
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackTitle}>
              {needsCloudPinSetup ? 'Defina o PIN de contingência' : 'Entrar com PIN de contingência'}
            </Text>
            <Text style={styles.fallbackText}>
              {needsCloudPinSetup
                ? 'Crie um PIN de 4 dígitos para backup em nuvem e recuperação segura.'
                : 'Use o PIN salvo em nuvem caso o login social não esteja disponível.'}
            </Text>
            <TextInput
              value={fallbackPin}
              onChangeText={setFallbackPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              style={styles.fallbackInput}
              placeholder="PIN de 4 dígitos"
              placeholderTextColor="#64748B"
            />
            <TouchableOpacity
              style={styles.fallbackButton}
              onPress={submitFallbackPin}
              disabled={fallbackBusy}>
              <Text style={styles.fallbackButtonText}>
                {fallbackBusy
                  ? 'Validando...'
                  : needsCloudPinSetup
                    ? 'Salvar PIN e continuar'
                    : 'Validar PIN e continuar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
  fallbackCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15,23,42,0.75)',
    padding: 12,
  },
  fallbackTitle: {
    color: '#E2E8F0',
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackText: {
    marginTop: 6,
    color: '#CBD5E1',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  fallbackInput: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15,23,42,0.95)',
    color: '#E2E8F0',
    textAlign: 'center',
    letterSpacing: 6,
    paddingVertical: 10,
    fontWeight: '800',
  },
  fallbackButton: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
    paddingVertical: 11,
    alignItems: 'center',
  },
  fallbackButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
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
