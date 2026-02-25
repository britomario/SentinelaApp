/**
 * Gamificação Modo Infantil: Tokens e desbloqueio de tempo em apps.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKENS_KEY = '@sentinela/child_tokens';
const UNLOCKS_KEY = '@sentinela/child_app_unlocks';
const TASKS_DONE_KEY = '@sentinela/child_tasks_done';

const DEFAULT_TOKENS = 150;
const MINUTES_PER_100_TOKENS = 30;

export type AppUnlock = {
  appId: string;
  minutesGranted: number;
  expiresAt: number;
};

export async function getTokens(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    if (raw != null) {
      const n = parseInt(raw, 10);
      if (!isNaN(n)) return Math.max(0, n);
    }
  } catch {
    // ignore
  }
  return DEFAULT_TOKENS;
}

export async function addTokens(amount: number): Promise<number> {
  const current = await getTokens();
  const next = Math.max(0, current + amount);
  await AsyncStorage.setItem(TOKENS_KEY, String(next));
  return next;
}

export async function spendTokens(amount: number): Promise<{ok: boolean; balance: number}> {
  const current = await getTokens();
  if (current < amount) {
    return {ok: false, balance: current};
  }
  const next = current - amount;
  await AsyncStorage.setItem(TOKENS_KEY, String(next));
  return {ok: true, balance: next};
}

export async function unlockAppWithTokens(
  appId: string,
  tokensToSpend: number,
): Promise<{ok: boolean; balance: number; minutesGranted: number}> {
  const {ok, balance} = await spendTokens(tokensToSpend);
  if (!ok) return {ok: false, balance, minutesGranted: 0};

  const minutesGranted = Math.floor((tokensToSpend / 100) * MINUTES_PER_100_TOKENS);
  const expiresAt = Date.now() + minutesGranted * 60 * 1000;

  const unlocks = await getAppUnlocks();
  const next = unlocks.filter(u => u.appId !== appId);
  next.push({appId, minutesGranted, expiresAt});
  await AsyncStorage.setItem(UNLOCKS_KEY, JSON.stringify(next));

  return {ok: true, balance, minutesGranted};
}

export async function getAppUnlocks(): Promise<AppUnlock[]> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppUnlock[];
    const now = Date.now();
    return (Array.isArray(parsed) ? parsed : []).filter(u => u.expiresAt > now);
  } catch {
    return [];
  }
}

export function getMinutesRemaining(unlock: AppUnlock): number {
  return Math.max(0, Math.floor((unlock.expiresAt - Date.now()) / 60000));
}

export function tokensForMinutes(minutes: number): number {
  return Math.ceil((minutes / MINUTES_PER_100_TOKENS) * 100);
}

export async function markTaskDone(taskId: string, reward: number): Promise<number> {
  const done = await getTasksDone();
  if (done.has(taskId)) return await getTokens();
  const next = new Set(done);
  next.add(taskId);
  await AsyncStorage.setItem(TASKS_DONE_KEY, JSON.stringify([...next]));
  return await addTokens(reward);
}

export async function getTasksDone(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_DONE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}
