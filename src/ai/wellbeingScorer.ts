import {NEGATIVE_WORDS, POSITIVE_WORDS} from './riskLexicon';

export type WellbeingLevel = 'green' | 'yellow';

export type WellbeingScore = {
  score: number;
  positiveHits: number;
  negativeHits: number;
  level: WellbeingLevel;
};

export function computeWellbeingScore(text: string): WellbeingScore {
  const normalized = normalize(text);
  let positiveHits = 0;
  let negativeHits = 0;

  for (const word of POSITIVE_WORDS) {
    if (normalized.includes(word)) {
      positiveHits += 1;
    }
  }

  for (const word of NEGATIVE_WORDS) {
    if (normalized.includes(word)) {
      negativeHits += 1;
    }
  }

  const raw = 65 + positiveHits * 8 - negativeHits * 12;
  const score = Math.max(0, Math.min(100, raw));
  const level: WellbeingLevel = score >= 55 ? 'green' : 'yellow';

  return {score, positiveHits, negativeHits, level};
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
