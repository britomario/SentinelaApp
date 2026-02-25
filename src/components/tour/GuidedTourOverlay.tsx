import React from 'react';
import {Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

export type TourStep = {
  title: string;
  description: string;
};

type GuidedTourOverlayProps = {
  visible: boolean;
  steps: TourStep[];
  stepIndex: number;
  onNext: () => void;
  onClose: () => void;
};

export default function GuidedTourOverlay({
  visible,
  steps,
  stepIndex,
  onNext,
  onClose,
}: GuidedTourOverlayProps): React.JSX.Element {
  const step = steps[stepIndex];
  if (!step) {
    return <></>;
  }

  const isLastStep = stepIndex >= steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Tour guiado</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
          <Text style={styles.progress}>
            Passo {stepIndex + 1} de {steps.length}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onClose}>
              <Text style={styles.secondaryText}>Pular</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={onNext}>
              <Text style={styles.primaryText}>{isLastStep ? 'Concluir' : 'Próximo'}</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  progress: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748B',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
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
    color: '#334155',
    fontWeight: '700',
  },
});
