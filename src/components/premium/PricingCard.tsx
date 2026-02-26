import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

type PricingCardProps = {
  annualPrice: number;
  currencySymbol?: string;
  ctaLabel: string;
  subtitle: string;
  highlight?: string;
  onPress: () => void;
};

export default function PricingCard({
  annualPrice,
  currencySymbol = 'R$',
  ctaLabel,
  subtitle,
  highlight,
  onPress,
}: PricingCardProps): React.JSX.Element {
  const dailyPrice = annualPrice / 365;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Licença Anual Premium</Text>
      <Text style={styles.value}>
        {currencySymbol}
        {annualPrice.toFixed(2).replace('.', ',')}
      </Text>
      <Text style={styles.daily}>
        ≈ {currencySymbol}
        {dailyPrice.toFixed(2).replace('.', ',')}/dia
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {!!highlight && <Text style={styles.highlight}>{highlight}</Text>}
      <TouchableOpacity style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    ...Shadows.low,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  value: {
    marginTop: Spacing.sm,
    fontSize: 34,
    fontWeight: '800',
    color: '#0066CC',
  },
  daily: {
    marginTop: 4,
    color: '#0F766E',
    fontWeight: '700',
  },
  subtitle: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  highlight: {
    marginTop: Spacing.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  button: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
