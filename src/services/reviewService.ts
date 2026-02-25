import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';

const REVIEW_STATE_KEY = 'sentinela.review.state.v1';
const MAX_DEFERS = 3;
const DEFER_DAYS = 7;

export type ReviewSignal =
  | 'climate_green_visible'
  | 'dns_private_configured'
  | 'pairing_success'
  | 'token_unlock_success';

type ReviewState = {
  rated: boolean;
  neverAskAgain: boolean;
  deferCount: number;
  lastPromptAt: number | null;
  nextEligibleAt: number | null;
  activeDays: string[];
  signals: Partial<Record<ReviewSignal, number>>;
};

const INITIAL_STATE: ReviewState = {
  rated: false,
  neverAskAgain: false,
  deferCount: 0,
  lastPromptAt: null,
  nextEligibleAt: null,
  activeDays: [],
  signals: {},
};

export type ReviewEligibility = {
  eligible: boolean;
  reason:
    | 'ok'
    | 'already_rated'
    | 'never_ask_again'
    | 'deferred'
    | 'too_many_defers'
    | 'insufficient_active_days'
    | 'missing_success_moment';
  state: ReviewState;
};

export async function trackActiveDay(nowMs = Date.now()): Promise<ReviewState> {
  const state = await readState();
  const dayKey = toDayKey(nowMs);
  if (!state.activeDays.includes(dayKey)) {
    state.activeDays = [...state.activeDays, dayKey].slice(-14);
    await writeState(state);
  }
  return state;
}

export async function recordSuccessSignal(
  signal: ReviewSignal,
  nowMs = Date.now(),
): Promise<ReviewState> {
  const state = await readState();
  if (!state.signals[signal]) {
    state.signals[signal] = nowMs;
    await writeState(state);
  }
  return state;
}

export async function getReviewEligibility(
  nowMs = Date.now(),
): Promise<ReviewEligibility> {
  const state = await readState();

  if (state.rated) {
    return {eligible: false, reason: 'already_rated', state};
  }
  if (state.neverAskAgain) {
    return {eligible: false, reason: 'never_ask_again', state};
  }
  if (state.deferCount >= MAX_DEFERS) {
    return {eligible: false, reason: 'too_many_defers', state};
  }
  if (state.nextEligibleAt && nowMs < state.nextEligibleAt) {
    return {eligible: false, reason: 'deferred', state};
  }

  const activeDaysCount = state.activeDays.length;
  const hasPairingSuccess = !!state.signals.pairing_success;
  const hasSuccessMoment =
    !!state.signals.climate_green_visible ||
    !!state.signals.dns_private_configured ||
    !!state.signals.token_unlock_success ||
    hasPairingSuccess;

  if (activeDaysCount < 3 && !hasPairingSuccess) {
    return {eligible: false, reason: 'insufficient_active_days', state};
  }
  if (!hasSuccessMoment) {
    return {eligible: false, reason: 'missing_success_moment', state};
  }

  return {eligible: true, reason: 'ok', state};
}

export async function markPromptShown(nowMs = Date.now()): Promise<void> {
  const state = await readState();
  state.lastPromptAt = nowMs;
  await writeState(state);
}

export async function deferReviewForDays(days = DEFER_DAYS): Promise<void> {
  const state = await readState();
  state.deferCount += 1;
  state.nextEligibleAt = Date.now() + days * 24 * 60 * 60 * 1000;
  await writeState(state);
}

export async function setNeverAskAgain(): Promise<void> {
  const state = await readState();
  state.neverAskAgain = true;
  await writeState(state);
}

export async function markRated(): Promise<void> {
  const state = await readState();
  state.rated = true;
  state.nextEligibleAt = null;
  await writeState(state);
}

export async function requestNativeReviewIfAvailable(): Promise<boolean> {
  if (!InAppReview.isAvailable()) {
    return false;
  }
  try {
    await InAppReview.RequestInAppReview();
    return true;
  } catch {
    return false;
  }
}

async function readState(): Promise<ReviewState> {
  const raw = await AsyncStorage.getItem(REVIEW_STATE_KEY);
  if (!raw) {
    return {...INITIAL_STATE};
  }
  try {
    return {...INITIAL_STATE, ...(JSON.parse(raw) as Partial<ReviewState>)};
  } catch {
    return {...INITIAL_STATE};
  }
}

async function writeState(state: ReviewState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
}

function toDayKey(nowMs: number): string {
  const d = new Date(nowMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
