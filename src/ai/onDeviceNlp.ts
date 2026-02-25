import {RISK_WORDS} from './riskLexicon';
import {computeWellbeingScore} from './wellbeingScorer';

export type RiskBucket = keyof typeof RISK_WORDS;

export type NlpInsight = {
  wellbeing: ReturnType<typeof computeWellbeingScore>;
  riskCounts: Record<RiskBucket, number>;
  topRisk: RiskBucket | null;
  summary: string;
};

export function analyzeOnDevice(messages: string[]): NlpInsight {
  const joined = normalize(messages.join(' '));
  const riskCounts: Record<RiskBucket, number> = {
    hate: 0,
    violence: 0,
    sexual: 0,
  };

  (Object.keys(RISK_WORDS) as RiskBucket[]).forEach(bucket => {
    for (const token of RISK_WORDS[bucket]) {
      if (joined.includes(token)) {
        riskCounts[bucket] += 1;
      }
    }
  });

  const wellbeing = computeWellbeingScore(joined);
  const topRisk = resolveTopRisk(riskCounts);
  const summary = buildSummary(wellbeing.score, topRisk);

  return {wellbeing, riskCounts, topRisk, summary};
}

function resolveTopRisk(riskCounts: Record<RiskBucket, number>): RiskBucket | null {
  const ordered = (Object.keys(riskCounts) as RiskBucket[]).sort(
    (a, b) => riskCounts[b] - riskCounts[a],
  );
  if (!ordered.length || riskCounts[ordered[0]] === 0) {
    return null;
  }
  return ordered[0];
}

function buildSummary(score: number, topRisk: RiskBucket | null): string {
  if (topRisk) {
    return `Atenção: sinais de risco em ${topRisk}. Sugira conversa aberta em família.`;
  }
  if (score >= 70) {
    return 'Clima emocional saudável e sem sinais críticos recentes.';
  }
  return 'Clima estável, porém com sinais de estresse leve.';
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
