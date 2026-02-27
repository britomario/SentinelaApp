import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useToast} from '../../components/feedback/ToastProvider';

import PinGate from '../../components/security/PinGate';
import {isRestricted, setRestricted} from '../../services/restrictedModeService';

export default function ChildRestrictedScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const {showToast} = useToast();
  const [restricted, setRestrictedState] = useState(true);
  const [pinGateVisible, setPinGateVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const loadState = useCallback(async () => {
    const value = await isRestricted();
    setRestrictedState(value);
    setReady(true);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleUnlock = async (_pin: string) => {
    await setRestricted(false);
    setRestrictedState(false);
    setPinGateVisible(false);
    showToast({
      kind: 'success',
      title: 'Acesso autorizado',
      message: 'Sessão liberada para manutenção supervisionada.',
    });
  };

  const handleReativar = async () => {
    await setRestricted(true);
    setRestrictedState(true);
    showToast({kind: 'success', title: 'Modo restrito reativado'});
  };

  if (!ready) {
    return <></>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {restricted ? 'Você está protegido pelo Sentinela' : 'Modo restrito desativado'}
      </Text>
      <Text style={styles.subtitle}>
        {restricted
          ? 'Modo restrito impede alterações em ajustes e proteções sem o PIN do responsável. Para liberar o acesso às configurações, digite o PIN mestre.'
          : 'O acesso às configurações está liberado. Toque abaixo para reativar a proteção.'}
      </Text>

      {restricted ? (
        <TouchableOpacity
          style={styles.lockBtn}
          onPress={() => setPinGateVisible(true)}>
          <Text style={styles.lockBtnText}>Desbloquear com PIN</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.reactivarBox}>
          <Text style={styles.reactivarTitle}>Reativar modo restrito</Text>
          <Text style={styles.reactivarText}>
            O responsável pode configurar o dispositivo. Toque abaixo para voltar à proteção.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleReativar}>
            <Text style={styles.primaryBtnText}>Reativar modo restrito</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Config')}>
            <Text style={styles.secondaryBtnText}>Voltar aos ajustes</Text>
          </TouchableOpacity>
        </View>
      )}

      <PinGate
        visible={pinGateVisible}
        onClose={() => setPinGateVisible(false)}
        onSuccess={() => {}}
        onSuccessWithPin={handleUnlock}
        title="Digite o PIN mestre para liberar configurações"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  title: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 28,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 21,
  },
  lockBtn: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 13,
  },
  lockBtnText: {color: '#93C5FD', textAlign: 'center', fontWeight: '700'},
  reactivarBox: {
    marginTop: 24,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reactivarTitle: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
  },
  reactivarText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: '#0066CC',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {color: '#FFFFFF', fontWeight: '700', fontSize: 16},
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: {color: '#93C5FD', textAlign: 'center', fontWeight: '600'},
});
