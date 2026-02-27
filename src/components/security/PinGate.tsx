/**
 * Gate de PIN - executa callback após validação do PIN.
 */

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
import {useToast} from '../feedback/ToastProvider';
import {Colors, Spacing, BorderRadius} from '../../theme/colors';

const {SecurityModule} = NativeModules as {
  SecurityModule?: { validateSecurityPin?: (pin: string) => Promise<boolean> };
};

type PinGateProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Chamado com o PIN validado antes de onSuccess; use quando a ação precisar do PIN (ex.: Escudo). */
  onSuccessWithPin?: (pin: string) => void;
  title?: string;
};

export default function PinGate({
  visible,
  onClose,
  onSuccess,
  onSuccessWithPin,
  title = 'Digite o PIN',
}: PinGateProps): React.JSX.Element {
  const {showToast} = useToast();
  const [pin, setPin] = useState('');

  const validate = async () => {
    if (pin.length !== 4) {
      showToast({ kind: 'error', title: 'PIN deve ter 4 dígitos' });
      return;
    }
    try {
      const ok = await SecurityModule?.validateSecurityPin?.(pin);
      if (ok) {
        const validatedPin = pin;
        setPin('');
        onSuccessWithPin?.(validatedPin);
        onSuccess();
        onClose();
      } else {
        showToast({ kind: 'error', title: 'PIN incorreto' });
      }
    } catch {
      showToast({ kind: 'error', title: 'Falha ao validar' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            placeholder="PIN (4 dígitos)"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={4}
            value={pin}
            onChangeText={setPin}
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.validateBtn, pin.length !== 4 && styles.btnDisabled]}
              disabled={pin.length !== 4}
              onPress={validate}>
              <Text style={styles.validateText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: Spacing.lg,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 320,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  btn: { flex: 1, padding: Spacing.md, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: Colors.border },
  validateBtn: { backgroundColor: Colors.primary },
  btnDisabled: { opacity: 0.5 },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  validateText: { color: Colors.white, fontWeight: '700' },
});
