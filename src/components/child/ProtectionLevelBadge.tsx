/**
 * Badge "Escudo de Proteção Nível X" com barra de progresso e micro-animação.
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

const TOKENS_PER_LEVEL = 50;

export type LevelProgress = {
  level: number;
  tokensInLevel: number;
  tokensForNext: number;
  progressPct: number;
  nextLevel: number;
};

export function computeLevelProgress(tokens: number): LevelProgress {
  const level = Math.min(5, Math.floor(tokens / TOKENS_PER_LEVEL) + 1);
  const tokensInLevel = level >= 5 ? TOKENS_PER_LEVEL : tokens % TOKENS_PER_LEVEL;
  const tokensForNext = TOKENS_PER_LEVEL;
  const progressPct = level >= 5 ? 100 : (tokensInLevel / TOKENS_PER_LEVEL) * 100;
  const nextLevel = Math.min(5, level + 1);
  return {level, tokensInLevel, tokensForNext, progressPct, nextLevel};
}

type ProtectionLevelBadgeProps = {
  level: number;
  label?: string;
  animated?: boolean;
  /** Mostra barra de progresso para o próximo nível */
  progress?: LevelProgress | null;
};

export default function ProtectionLevelBadge({
  level,
  label = 'Nível',
  animated = true,
  progress = null,
}: ProtectionLevelBadgeProps): React.JSX.Element {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animated) {
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, {duration: 800}),
        withTiming(1, {duration: 800}),
      ),
      -1,
      true,
    );
  }, [animated, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const showProgressBar = progress && progress.level < 5;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.badge, animated && animatedStyle]}>
        <Text style={styles.icon}>🛡️</Text>
        <Text style={styles.text}>
          {label} {level}
        </Text>
      </Animated.View>
      {showProgressBar && (
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, {width: `${progress.progressPct}%`}]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.tokensInLevel}/{progress.tokensForNext} tokens para Nível{' '}
            {progress.nextLevel}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'stretch',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  progressSection: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
