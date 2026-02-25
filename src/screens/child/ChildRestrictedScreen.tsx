import React, {useState} from 'react';
import {
  Modal,
  NativeModules,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useToast} from '../../components/feedback/ToastProvider';

const {SecurityModule} = NativeModules as {
  SecurityModule?: {
    validateSecurityPin?: (pin: string) => Promise<boolean>;
  };
};

export default function ChildRestrictedScreen(): React.JSX.Element {
  const {showToast} = useToast();
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  const validate = async () => {
    try {
      const ok = await SecurityModule?.validateSecurityPin?.(pin);
      if (!ok) {
        showToast({
          kind: 'error',
          title: 'PIN invalido',
          message: 'Somente o responsavel pode liberar configuracoes sensiveis.',
        });
        return;
      }
      setUnlocked(true);
      showToast({
        kind: 'success',
        title: 'Acesso autorizado',
        message: 'Sessao liberada para manutencao supervisionada.',
      });
      setPin('');
    } catch {
      showToast({
        kind: 'error',
        title: 'Falha de validacao',
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voce esta protegido pelo Sentinela</Text>
      <Text style={styles.subtitle}>
        Este dispositivo esta em modo monitorado. Alteracoes de seguranca exigem PIN mestre do responsavel.
      </Text>
      <TouchableOpacity style={styles.lockBtn} onPress={() => setUnlocked(false)}>
        <Text style={styles.lockBtnText}>Manter modo restrito ativo</Text>
      </TouchableOpacity>

      <Modal transparent visible={!unlocked} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Acesso restrito</Text>
            <Text style={styles.modalText}>
              Digite o PIN mestre para abrir configuracoes ou remover protecoes.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="PIN mestre"
              placeholderTextColor="#64748B"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
            />
            <TouchableOpacity
              style={[styles.actionBtn, pin.length !== 4 && styles.actionBtnDisabled]}
              disabled={pin.length !== 4}
              onPress={validate}>
              <Text style={styles.actionBtnText}>Validar autorizacao</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.82)',
    padding: 20,
  },
  modal: {width: '100%', backgroundColor: '#111827', borderRadius: 16, padding: 20},
  modalTitle: {color: '#E2E8F0', fontWeight: '800', fontSize: 20},
  modalText: {marginTop: 8, color: '#94A3B8', lineHeight: 19},
  input: {
    marginTop: 14,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
  },
  actionBtn: {
    marginTop: 14,
    backgroundColor: '#0066CC',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnDisabled: {opacity: 0.5},
  actionBtnText: {color: '#FFFFFF', textAlign: 'center', fontWeight: '700'},
});
