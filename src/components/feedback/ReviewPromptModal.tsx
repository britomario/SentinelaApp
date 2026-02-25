import React from 'react';
import {Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

type ReviewPromptModalProps = {
  visible: boolean;
  onRateNow: () => void;
  onLater: () => void;
  onNeverAskAgain: () => void;
};

export default function ReviewPromptModal({
  visible,
  onRateNow,
  onLater,
  onNeverAskAgain,
}: ReviewPromptModalProps): React.JSX.Element {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Gostando do Sentinela?</Text>
          <Text style={styles.message}>
            Sua avaliacao ajuda outras familias a encontrarem uma protecao digital confiavel.
          </Text>
          <TouchableOpacity style={[styles.button, styles.primary]} onPress={onRateNow}>
            <Text style={styles.primaryText}>Avaliar Agora</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onLater}>
            <Text style={styles.secondaryText}>Mais Tarde</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={onNeverAskAgain}>
            <Text style={styles.linkText}>Nao perguntar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  message: {
    marginTop: 8,
    color: '#475569',
    lineHeight: 20,
  },
  button: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#0066CC',
  },
  secondary: {
    backgroundColor: '#E2E8F0',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryText: {
    color: '#1E293B',
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#475569',
    fontWeight: '600',
  },
});
