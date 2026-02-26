import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useNavigation} from '@react-navigation/native';

import {useToast} from '../../components/feedback/ToastProvider';
import {useReviewPrompt} from '../../components/feedback/ReviewPromptProvider';
import {ensureParentKeyPair} from '../../security/e2eeService';
import {getPushSubscriptionId, initializeOneSignal} from '../../services/notifications/oneSignalService';
import {
  createPairingPayload,
  deriveChildIdFromPairToken,
  PairingPayload,
  setSelectedChildId,
  storeParentPairingToken,
} from '../../services/pairingService';
import {
  addChildProfileFromPairing,
  getChildrenProfiles,
  MAX_CHILDREN_PROFILES,
} from '../../services/childrenProfilesService';
import {registerPairingOnServer} from '../../services/pairingSyncService';

export default function PairingScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const {showToast} = useToast();
  const {recordReviewSignal} = useReviewPrompt();
  const [payload, setPayload] = useState<PairingPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [childrenCount, setChildrenCount] = useState(0);

  const issueNewPairingCode = useCallback(async (): Promise<void> => {
    const profiles = await getChildrenProfiles();
    if (profiles.length >= MAX_CHILDREN_PROFILES) {
      showToast({
        kind: 'info',
        title: 'Limite de perfis atingido',
        message: `Máximo de ${MAX_CHILDREN_PROFILES} filhos/dispositivos nesta versão.`,
      });
      return;
    }
    setBusy(true);
    try {
      await initializeOneSignal();
      const keys = await ensureParentKeyPair();
      const nextPayload = createPairingPayload(keys.publicKeyB64);
      await storeParentPairingToken(nextPayload.pairToken);
      const childId = deriveChildIdFromPairToken(nextPayload.pairToken);
      await setSelectedChildId(childId);
      const {profiles: nextProfiles} = await addChildProfileFromPairing(childId);
      setChildrenCount(nextProfiles.length);
      setPayload(nextPayload);
      await registerPairingOnServer(childId).catch(() => undefined);
      const pushId = await getPushSubscriptionId();
      showToast({
        kind: 'success',
        title: 'QR de pareamento gerado',
        message: pushId
          ? 'Use em ate 10 minutos para vincular o celular da crianca.'
          : 'QR gerado. Ative notificacoes para receber alertas no modo responsavel.',
      });
      recordReviewSignal('pairing_success').catch(() => undefined);
    } catch (error: unknown) {
      showToast({
        kind: 'error',
        title: 'Falha ao gerar QR',
        message: getErrorMessage(error),
      });
    } finally {
      setBusy(false);
    }
  }, [recordReviewSignal, showToast]);

  useEffect(() => {
    issueNewPairingCode().catch(() => undefined);
  }, [issueNewPairingCode]);

  useEffect(() => {
    getChildrenProfiles()
      .then(profiles => setChildrenCount(profiles.length))
      .catch(() => setChildrenCount(0));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expiresIn = useMemo(() => {
    if (!payload) {
      return 0;
    }
    return Math.max(0, Math.floor((payload.expiresAt - now) / 1000));
  }, [payload, now]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pareamento por QR Code</Text>
      <Text style={styles.subtitle}>
        Este QR contem o link para loja e um token temporario seguro para vincular o app da crianca ao seu modo parental.
      </Text>
      <View style={styles.limitPill}>
        <Text style={styles.limitPillText}>
          Perfis conectados: {childrenCount}/{MAX_CHILDREN_PROFILES}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Filhos')}>
          <Text style={styles.limitPillLink}>Gerenciar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.qrCard}>
        {payload ? (
          <>
            <QRCode value={payload.appDeepLink} size={220} />
            <Text style={styles.expireText}>Expira em: {expiresIn}s</Text>
            <Text style={styles.token}>Token: {payload.pairToken.slice(0, 10)}...</Text>
          </>
        ) : (
          <Text style={styles.loading}>Gerando QR...</Text>
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => issueNewPairingCode()} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Gerando...' : 'Gerar novo QR dinamico'}</Text>
      </TouchableOpacity>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Zero-Knowledge ativo</Text>
        <Text style={styles.noticeText}>
          A chave privada fica apenas no seu dispositivo. O celular da crianca recebe apenas a chave publica para criptografia E2EE.
        </Text>
      </View>
    </ScrollView>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Nao foi possivel gerar o pareamento agora.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 44,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 8,
    color: '#475569',
    lineHeight: 20,
  },
  limitPill: {
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  limitPillText: {
    color: '#312E81',
    fontWeight: '600',
    fontSize: 12,
  },
  limitPillLink: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 12,
  },
  qrCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loading: {
    color: '#64748B',
  },
  expireText: {
    marginTop: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  token: {
    marginTop: 6,
    color: '#334155',
    fontSize: 12,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#0066CC',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  notice: {
    marginTop: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  noticeTitle: {
    color: '#065F46',
    fontWeight: '700',
  },
  noticeText: {
    marginTop: 4,
    color: '#065F46',
    lineHeight: 19,
  },
});
