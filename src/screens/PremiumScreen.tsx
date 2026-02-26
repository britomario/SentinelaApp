import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PlanComparison from '../components/premium/PlanComparison';
import PlanCard from '../components/premium/PlanCard';
import { useToast } from '../components/feedback/ToastProvider';
import {
  activateAnnualLicense,
  activateMonthlyLicense,
  getPremiumState,
  PremiumState,
  startTrial,
} from '../services/subscriptionService';
import { openStore } from '../services/storeUrls';
import { BorderRadius, Colors, Shadows, Spacing } from '../theme/colors';

function formatStatus(state: PremiumState): string {
  if (state.status === 'premium_active' || state.annualActive) {
    return 'Ativo';
  }
  if (state.status === 'trial_active' && state.trialActive) {
    return `Trial (${state.trialDaysLeft} dias restantes)`;
  }
  if (state.status === 'grace_period') {
    return 'Ativo';
  }
  return 'Free';
}

const INITIAL_STATE: PremiumState = {
  status: 'trial_available',
  trialStartedAt: null,
  trialDaysLeft: 7,
  trialActive: false,
  annualActive: false,
};

const COMPARISON_ITEMS = [
  { label: 'Pareamento familiar', icon: 'infinity' as const, free: true, premium: true },
  { label: 'Modo Dormir', icon: 'moon' as const, free: true, premium: true },
  { label: 'Bloqueio de Aplicativos', icon: 'lock' as const, free: 'Até 3', premium: 'Ilimitado' },
  { label: 'Controle de Tarefas', icon: 'shieldCheck' as const, free: 'Até 3', premium: 'Ilimitado' },
  { label: 'Bloqueio de Pornografia', icon: 'shieldAlert' as const, free: false, premium: true },
  { label: 'Proteção 24/7 no dispositivo', icon: 'shield' as const, free: false, premium: true },
  { label: 'Relatórios detalhados de risco', icon: 'barChart' as const, free: false, premium: true },
  { label: 'Suporte prioritário', icon: 'headset' as const, free: false, premium: true },
];

type PlanType = 'monthly' | 'annual';

const MONTHLY_PRICE = 14.9;
const ANNUAL_PRICE = 54.9;
const ANNUAL_EQUIVALENT_MONTHLY = 4.58;
const SAVINGS_PERCENT = 69;

export default function PremiumScreen(): React.JSX.Element {
  const [state, setState] = useState<PremiumState>(INITIAL_STATE);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
  const { showToast } = useToast();

  useEffect(() => {
    getPremiumState().then(setState).catch(() => setState(INITIAL_STATE));
  }, []);

  const handleStartTrial = async () => {
    const next = await startTrial();
    setState(next);
    showToast({
      kind: 'success',
      title: 'Trial ativado',
      message: `Você tem ${next.trialDaysLeft} dias para testar o Premium.`,
    });
  };

  const handlePurchase = async () => {
    const activate = selectedPlan === 'annual' ? activateAnnualLicense : activateMonthlyLicense;
    const next = await activate();
    setState(next);
    if (next.annualActive || next.status === 'premium_active') {
      showToast({
        kind: 'success',
        title: 'Premium ativo',
        message: 'Recursos premium desbloqueados no dispositivo.',
      });
    } else {
      openStore().catch(() => undefined);
      showToast({
        kind: 'info',
        title: 'Abrindo loja',
        message: 'Complete a assinatura na loja para ativar o Premium.',
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Premium+</Text>
      <Text style={styles.subtitle}>
        Desbloqueie IA avançada, políticas de DNS reforçadas e proteção parental contínua.
      </Text>

      <PlanComparison benefits={COMPARISON_ITEMS} />

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Status atual</Text>
        <Text style={styles.statusLine}>{formatStatus(state)}</Text>
      </View>

      <Text style={styles.planSectionTitle}>Escolha seu plano</Text>
      <View style={styles.planCardsRow}>
        <PlanCard
          type="monthly"
          price={MONTHLY_PRICE}
          periodLabel="Mensal"
          onSelect={() => setSelectedPlan('monthly')}
          selected={selectedPlan === 'monthly'}
        />
        <PlanCard
          type="annual"
          price={ANNUAL_PRICE}
          periodLabel="Anual"
          equivalentMonthly={ANNUAL_EQUIVALENT_MONTHLY}
          savingsPercent={SAVINGS_PERCENT}
          badge="Mais vantajoso"
          highlighted
          onSelect={() => setSelectedPlan('annual')}
          selected={selectedPlan === 'annual'}
        />
      </View>

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={handlePurchase}
        activeOpacity={0.85}>
        <Text style={styles.ctaButtonText}>
          {selectedPlan === 'annual' ? 'Ativar licença anual' : 'Ativar plano mensal'}
        </Text>
      </TouchableOpacity>

      <View style={styles.trialBox}>
        <Text style={styles.trialTitle}>Teste grátis de 7 dias</Text>
        <Text style={styles.trialDesc}>
          Avalie recursos premium sem compromisso, com cancelamento simples.
        </Text>
        {state.status === 'trial_available' ? (
          <Text style={styles.trialBtn} onPress={handleStartTrial}>
            Iniciar trial agora
          </Text>
        ) : null}
        <TouchableOpacity onPress={() => openStore().catch(() => undefined)}>
          <Text style={styles.trialStoreLink}>teste gratis</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.low,
  },
  statusTitle: {
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  statusLine: {
    color: Colors.textSecondary,
  },
  planSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  planCardsRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  ctaButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.low,
  },
  ctaButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  trialBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  trialDesc: {
    marginTop: 6,
    color: '#3730A3',
  },
  trialBtn: {
    marginTop: Spacing.sm,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  trialStoreLink: {
    marginTop: 14,
    color: '#4F46E5',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
