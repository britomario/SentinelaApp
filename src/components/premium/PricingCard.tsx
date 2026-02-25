import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  value: {
    marginTop: 8,
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
    marginTop: 12,
    color: '#475569',
    lineHeight: 20,
  },
  highlight: {
    marginTop: 8,
    color: '#1E293B',
    fontWeight: '600',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#0066CC',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
