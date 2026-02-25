/**
 * Grade gamificada de apps do Modo Infantil com ícones grandes e micro-interações.
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import AppIcon from '../apps/AppIcon';
import type {AppIconEntry} from '../../assets/appIconCatalog';
import type {AppUnlock} from '../../services/childTokenService';
import {Colors, Spacing} from '../../theme/colors';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const TOKENS_PER_30MIN = 100;

type AppGridProps = Readonly<{
  apps: AppIconEntry[];
  tokens: number;
  unlocks: AppUnlock[];
  onUnlockRequest: (appId: string) => void;
  onAppPress: (app: AppIconEntry) => void;
}>;

export default function AppGrid({
  apps,
  tokens,
  unlocks,
  onUnlockRequest,
  onAppPress,
}: AppGridProps): React.JSX.Element {
  return (
    <View style={styles.grid}>
      {apps.map(app => (
        <AppGridItem
          key={app.id}
          app={app}
          tokens={tokens}
          unlock={unlocks.find(u => u.appId === app.id)}
          onUnlockRequest={onUnlockRequest}
          onPress={onAppPress}
        />
      ))}
    </View>
  );
}

type AppGridItemProps = Readonly<{
  app: AppIconEntry;
  tokens: number;
  unlock?: AppUnlock;
  onUnlockRequest: (appId: string) => void;
  onPress: (app: AppIconEntry) => void;
}>;

function AppGridItem({
  app,
  tokens,
  unlock,
  onUnlockRequest,
  onPress,
}: AppGridItemProps): React.JSX.Element {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, {damping: 15, stiffness: 400});
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const minutesLeft = unlock
    ? Math.max(0, Math.floor((unlock.expiresAt - Date.now()) / 60000))
    : 0;
  const isUnlocked = minutesLeft > 0;
  const canUnlock = !isUnlocked && tokens >= TOKENS_PER_30MIN;

  const handlePress = () => {
    if (isUnlocked) {
      onPress(app);
    } else if (canUnlock) {
      onUnlockRequest(app.id);
    }
  };

  return (
    <AnimatedTouchable
      style={[styles.item, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      activeOpacity={1}>
      <AppIcon name={app.name} size={56} iconUri={app.iconUrl} />
      <Text style={styles.label} numberOfLines={2}>
        {app.name}
      </Text>
      {isUnlocked && (
        <Text style={styles.timer}>{minutesLeft} min</Text>
      )}
      {!isUnlocked && canUnlock && (
        <Text style={styles.unlockHint}>{TOKENS_PER_30MIN} tokens</Text>
      )}
      {!isUnlocked && !canUnlock && tokens < TOKENS_PER_30MIN && (
        <Text style={styles.lockedHint}>Tokens</Text>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  item: {
    width: 88,
    height: 100,
    borderRadius: 24,
    backgroundColor: Colors.childCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  timer: {
    fontSize: 10,
    color: Colors.mint,
    fontWeight: '700',
    marginTop: 2,
  },
  unlockHint: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  lockedHint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
