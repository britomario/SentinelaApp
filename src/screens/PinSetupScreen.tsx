/**
 * Tela de setup inicial do PIN de segurança
 */

import React, {useState} from 'react';
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  NativeModules,
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useToast} from '../components/feedback/ToastProvider';

const {SecurityModule} = NativeModules as any;

type RootStackParamList = {
  PinSetup: undefined;
  Main: undefined;
};

export default function PinSetupScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'PinSetup'>>();
  const {showToast} = useToast();
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const savePinSetup = async () => {
    if (pinValue.length !== 4 || pinConfirm.length !== 4) {
      showToast({
        kind: 'error',
        title: 'PIN inválido',
        message: 'O PIN deve ter 4 dígitos.',
      });
      return;
    }
    if (pinValue !== pinConfirm) {
      showToast({
        kind: 'error',
        title: 'PIN não confere',
        message: 'Os PINs digitados são diferentes.',
      });
      return;
    }
    try {
      await SecurityModule?.setSecurityPin?.(pinValue);
      setPinValue('');
      setPinConfirm('');
      showToast({
        kind: 'success',
        title: 'PIN definido com sucesso',
      });
      navigation.replace('Main');
    } catch (e: any) {
      showToast({
        kind: 'error',
        title: 'Falha ao salvar PIN',
        message: e?.message ?? 'Tente novamente em instantes.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1720" />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Proteção parental</Text>
        <Text style={styles.desc}>
          Defina um PIN de 4 dígitos para impedir que a criança desative a proteção ou altere as configurações.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="PIN (4 dígitos)"
          placeholderTextColor="#6b7280"
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
          value={pinValue}
          onChangeText={setPinValue}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirme o PIN"
          placeholderTextColor="#6b7280"
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
          value={pinConfirm}
          onChangeText={setPinConfirm}
        />
        <TouchableOpacity style={styles.button} onPress={savePinSetup}>
          <Text style={styles.buttonText}>Definir PIN</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1720',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#e6eef8',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  desc: {
    color: '#9aa6b2',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#e6eef8',
    fontSize: 18,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
