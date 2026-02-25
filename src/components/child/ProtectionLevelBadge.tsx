/**
 * Badge "Escudo de Proteção Nível X" com micro-animação de pulsação.
 */

import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {Colors, Spacing, BorderRadius} from '../../theme/colors';

type ProtectionLevelBadgeProps = {
  level: number;
  label?: string;
  animated?: boolean;
};

export default function ProtectionLevelBadge({
  level,
  label = 'Nível',
  animated = true,
}: ProtectionLevelBadgeProps): React.JSX.Element {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animated) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, {duration: 800}),
        withTiming(1, {duration: 800}),
      ),
      -1,
      true,
    );
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  return (
    <Animated.View style={[styles.badge, animated && animatedStyle]}>
      <Text style={styles.icon}>🛡️</Text>
      <Text style={styles.text}>
        {label} {level}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  icon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
