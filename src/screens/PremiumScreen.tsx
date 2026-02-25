import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import PricingCard from '../components/premium/PricingCard';
import {useToast} from '../components/feedback/ToastProvider';
import {
  activateAnnualLicense,
  getPremiumState,
  PremiumState,
  PremiumStatus,
  startTrial,
} from '../services/subscriptionService';
import {openStore} from '../services/storeUrls';

function formatStatus(state: PremiumState): string {
  const statusLabels: Record<PremiumStatus, string> = {
    trial_available: 'Trial disponível (7 dias grátis)',
    trial_active: 'Trial ativo',
    grace_period: 'Período de carência ativo',
    expired: 'Assinatura expirada',
    premium_active: 'Premium ativo',
  };
  return statusLabels[state.status] ?? state.status;
}

const INITIAL_STATE: PremiumState = {
  status: 'trial_available',
  trialStartedAt: null,
  trialDaysLeft: 7,
  trialActive: false,
  annualActive: false,
};

export default function PremiumScreen(): React.JSX.Element {
  const [state, setState] = useState<PremiumState>(INITIAL_STATE);
  const {showToast} = useToast();

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

  const handleAnnual = async () => {
    const next = await activateAnnualLicense();
    setState(next);
    if (next.annualActive) {
      showToast({
        kind: 'success',
        title: 'Licença anual ativa',
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
      <Text style={styles.title}>Sentinela Premium</Text>
      <Text style={styles.subtitle}>
        Desbloqueie IA avançada, políticas de DNS reforçadas e proteção parental contínua.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Status atual</Text>
        <Text style={styles.statusLine}>
          {formatStatus(state)}
        </Text>
        {state.trialActive && (
          <Text style={styles.statusLine}>
            Trial: {state.trialDaysLeft} dias restantes
          </Text>
        )}
      </View>

      <PricingCard
        annualPrice={54.9}
        subtitle="Plano ideal para cobertura familiar durante todo o ano."
        highlight="Menos que R$0,16 por dia para proteção completa."
        ctaLabel="Ativar licença anual"
        onPress={handleAnnual}
      />

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
          <Text style={styles.trialStoreLink}>
            Teste grátis na loja (Google Play / App Store)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 44,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    color: '#475569',
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  statusTitle: {
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  statusLine: {
    color: '#334155',
  },
  trialBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 16,
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
    marginTop: 12,
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
