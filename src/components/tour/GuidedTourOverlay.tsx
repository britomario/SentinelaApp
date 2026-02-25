import React from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type TourStep = {
  title: string;
  description: string;
};

export type TourAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GuidedTourOverlayProps = {
  visible: boolean;
  steps: TourStep[];
  stepIndex: number;
  onNext: () => void;
  onClose: () => void;
  anchor?: TourAnchor | null;
};

export default function GuidedTourOverlay({
  visible,
  steps,
  stepIndex,
  onNext,
  onClose,
  anchor,
}: GuidedTourOverlayProps): React.JSX.Element {
  const step = steps[stepIndex];
  if (!step) {
    return <></>;
  }

  const isLastStep = stepIndex >= steps.length - 1;
  const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
  const cardWidth = Math.min(screenWidth - 32, 340);
  const cardHeightEstimate = 220;

  const fallbackTop = Math.max(16, screenHeight - cardHeightEstimate - 24);
  let cardTop = fallbackTop;
  let cardLeft = (screenWidth - cardWidth) / 2;

  if (anchor) {
    const spaceAbove = anchor.y - 16;
    const spaceBelow = screenHeight - (anchor.y + anchor.height) - 16;
    const shouldPlaceAbove =
      spaceAbove > cardHeightEstimate && spaceAbove > spaceBelow;

    cardTop = shouldPlaceAbove
      ? Math.max(16, anchor.y - cardHeightEstimate - 12)
      : Math.min(
          screenHeight - cardHeightEstimate - 16,
          anchor.y + anchor.height + 12,
        );

    const centeredLeft = anchor.x + anchor.width / 2 - cardWidth / 2;
    cardLeft = Math.min(Math.max(16, centeredLeft), screenWidth - cardWidth - 16);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {anchor ? (
          <View
            style={[
              styles.anchorHighlight,
              {
                left: Math.max(8, anchor.x - 6),
                top: Math.max(8, anchor.y - 6),
                width: anchor.width + 12,
                height: anchor.height + 12,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              top: cardTop,
              left: cardLeft,
            },
          ]}>
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
    padding: 16,
  },
  anchorHighlight: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  card: {
    position: 'absolute',
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
