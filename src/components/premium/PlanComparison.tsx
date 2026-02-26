/**
 * Grade de comparação Gratuito vs Premium.
 * Layout em duas colunas com headers elegantes e ícones por recurso.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Infinity,
  Moon,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Shield,
  BarChart2,
  Headset,
  Crown,
} from 'lucide-react-native';

import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

export type BenefitItem = {
  label: string;
  icon: 'infinity' | 'moon' | 'lock' | 'shieldCheck' | 'shieldAlert' | 'shield' | 'barChart' | 'headset';
  free: boolean | string;
  premium: boolean | string;
};

type PlanComparisonProps = {
  benefits: BenefitItem[];
};

const ICON_MAP = {
  infinity: Infinity,
  moon: Moon,
  lock: Lock,
  shieldCheck: ShieldCheck,
  shieldAlert: ShieldAlert,
  shield: Shield,
  barChart: BarChart2,
  headset: Headset,
};

function formatCell(value: boolean | string): {type: 'check' | 'x' | 'badge'; text?: string} {
  if (typeof value === 'string') {
    return {type: 'badge', text: value};
  }
  return value ? {type: 'check'} : {type: 'x'};
}

function BenefitRow({item}: {item: BenefitItem}): React.JSX.Element {
  const IconComponent = ICON_MAP[item.icon];
  const freeCell = formatCell(item.free);
  const premiumCell = formatCell(item.premium);

  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitLabelWrap}>
        {IconComponent && (
          <View style={styles.benefitIconWrap}>
            <IconComponent size={18} color={Colors.textSecondary} />
          </View>
        )}
        <Text style={styles.benefitLabel}>{item.label}</Text>
      </View>
      <View style={[styles.cell, styles.freeCell]}>
        {freeCell.type === 'check' && <Text style={styles.checkMark}>✓</Text>}
        {freeCell.type === 'x' && <Text style={styles.xMark}>✗</Text>}
        {freeCell.type === 'badge' && (
          <View style={styles.badgeLimit}>
            <Text style={styles.badgeLimitText}>{freeCell.text}</Text>
          </View>
        )}
      </View>
      <View style={[styles.cell, styles.premiumCell]}>
        {premiumCell.type === 'check' && <Text style={styles.checkMark}>✓</Text>}
        {premiumCell.type === 'x' && <Text style={styles.xMark}>✗</Text>}
        {premiumCell.type === 'badge' && (
          <View style={styles.badgeUnlimited}>
            <Text style={styles.badgeUnlimitedText}>{premiumCell.text}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function PlanComparison({benefits}: PlanComparisonProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compare e escolha proteção total</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <View style={styles.headerLabelPlaceholder} />
          <View style={[styles.headerCol, styles.freeHeaderCol]}>
            <Shield size={22} color="#312E81" />
            <Text style={styles.freeHeaderTitle}>Gratuito</Text>
            <View style={styles.badgeFree}>
              <Text style={styles.badgeFreeText}>GRÁTIS</Text>
            </View>
          </View>
          <LinearGradient
            colors={['#4C1D95', '#2563EB', '#06B6D4']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={[styles.headerCol, styles.premiumHeaderCol, Shadows.low]}>
            <View style={styles.premiumIconRow}>
              <Shield size={20} color={Colors.white} />
              <Crown size={12} color="#FBBF24" />
            </View>
            <Text style={styles.premiumHeaderTitle}>Premium</Text>
            <View style={styles.badgePremium}>
              <Text style={styles.badgePremiumText}>R$ 14,90/mês</Text>
            </View>
          </LinearGradient>
        </View>
        <View style={styles.benefitsList}>
          {benefits.map(item => (
            <BenefitRow key={item.label} item={item} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  table: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  headerLabelPlaceholder: {
    width: '42%',
    minWidth: 0,
  },
  headerCol: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    gap: 4,
  },
  freeHeaderCol: {
    backgroundColor: '#EEF2FF',
  },
  premiumHeaderCol: {
    minWidth: 0,
  },
  freeHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#312E81',
  },
  premiumIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  premiumHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  badgeFree: {
    backgroundColor: '#4F46E5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  badgeFreeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
  },
  badgePremium: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  badgePremiumText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  benefitsList: {
    backgroundColor: Colors.background,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  benefitLabelWrap: {
    width: '42%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingRight: Spacing.xs,
  },
  benefitIconWrap: {
    width: 24,
    alignItems: 'center',
  },
  benefitLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeCell: {},
  premiumCell: {},
  checkMark: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '800',
  },
  xMark: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  badgeLimit: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.sm,
  },
  badgeLimitText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  badgeUnlimited: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.sm,
  },
  badgeUnlimitedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
});
