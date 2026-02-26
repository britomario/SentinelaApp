import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

export type QuickNavAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  colors: [string, string];
  onPress: () => void;
};

type QuickActionsCardProps = {
  actions: QuickNavAction[];
};

export default function QuickActionsCard({
  actions,
}: QuickActionsCardProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Acessos rápidos</Text>
      <View style={styles.grid}>
        {actions.map(action => {
          const Icon = action.icon;
          return (
            <TouchableOpacity key={action.id} style={styles.itemWrap} onPress={action.onPress}>
              <LinearGradient
                colors={action.colors}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.item}>
                <View style={styles.iconWrap}>
                  <Icon color={Colors.white} size={24} />
                </View>
                <Text style={styles.itemLabel}>{action.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(15,23,42,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    padding: Spacing.md,
    ...Shadows.medium,
  },
  title: {
    color: '#C7D2FE',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemWrap: {
    width: '48.5%',
    marginBottom: Spacing.sm,
  },
  item: {
    minHeight: 108,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: Spacing.sm,
  },
  itemLabel: {
    textAlign: 'center',
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
