/**
 * Card de plano (Mensal ou Anual) para seleção na tela Premium.
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

export type PlanCardProps = {
  type: 'monthly' | 'annual';
  price: number;
  periodLabel: string;
  equivalentMonthly?: number;
  savingsPercent?: number;
  badge?: string;
  highlighted?: boolean;
  onSelect: () => void;
  selected: boolean;
};

export default function PlanCard({
  type: _type,
  price,
  periodLabel,
  equivalentMonthly,
  savingsPercent,
  badge,
  highlighted = false,
  onSelect,
  selected,
}: PlanCardProps): React.JSX.Element {
  const formatPrice = (value: number) =>
    `R$ ${value.toFixed(2).replace('.', ',')}`;

  const baseStyle = [
    styles.card,
    selected && styles.cardSelected,
  ];

  const cardContent = highlighted ? (
    <>
      {badge ? (
        <View style={[styles.badgeWrap, styles.badgeHighlighted]}>
          <Text style={[styles.badgeText, styles.badgeTextHighlighted]}>{badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.periodLabel, styles.textHighlighted]}>{periodLabel}</Text>
      <Text style={[styles.price, styles.textHighlighted]}>{formatPrice(price)}</Text>
      {equivalentMonthly !== undefined && (
        <Text style={[styles.equivalent, styles.textHighlightedMuted]}>
          Equivale a {formatPrice(equivalentMonthly)}/mês
        </Text>
      )}
      {savingsPercent !== undefined && (
        <View style={[styles.savingsWrap, styles.savingsWrapHighlighted]}>
          <Text style={[styles.savingsText, styles.savingsTextHighlighted]}>
            Economize {savingsPercent}% no plano anual
          </Text>
        </View>
      )}
    </>
  ) : (
    <>
      {badge ? (
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.periodLabel}>{periodLabel}</Text>
      <Text style={styles.price}>{formatPrice(price)}</Text>
      {equivalentMonthly !== undefined && (
        <Text style={styles.equivalent}>
          Equivale a {formatPrice(equivalentMonthly)}/mês
        </Text>
      )}
      {savingsPercent !== undefined && (
        <View style={styles.savingsWrap}>
          <Text style={styles.savingsText}>
            Economize {savingsPercent}% no plano anual
          </Text>
        </View>
      )}
    </>
  );

  if (highlighted) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onSelect}
        style={styles.touchable}>
        <LinearGradient
          colors={['#4C1D95', '#2563EB']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={[baseStyle, styles.cardHighlighted, selected && styles.cardHighlightedSelected]}>
          {cardContent}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      style={styles.touchable}>
      <View style={baseStyle}>
        {cardContent}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    ...Shadows.low,
  },
  cardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  cardHighlighted: {
    borderColor: 'transparent',
  },
  cardHighlightedSelected: {
    borderWidth: 2,
    borderColor: '#FBBF24',
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#FBBF24',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  equivalent: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  savingsWrap: {
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  badgeHighlighted: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  badgeTextHighlighted: {
    color: Colors.white,
  },
  textHighlighted: {
    color: Colors.white,
  },
  textHighlightedMuted: {
    color: 'rgba(255,255,255,0.85)',
  },
  savingsWrapHighlighted: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  savingsTextHighlighted: {
    color: Colors.white,
  },
});
