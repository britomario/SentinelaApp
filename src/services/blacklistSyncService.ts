import AsyncStorage from '@react-native-async-storage/async-storage';

import {getManualDomainLists} from './manualDomainListService';

const SYNC_META_KEY = '@sentinela/blacklist_sync';
const OTA_DOMAINS_KEY = '@sentinela/blocklist_ota';

const HAGEZI_URL =
  'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/multi.txt';
const STEVENBLACK_URL =
  'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts';

export type SyncStatus = {
  lastSyncAt: number | null;
  totalBlocked: number;
  lastError: string | null;
};

async function parseDomainsFromText(text: string, format: 'domains' | 'hosts'): Promise<string[]> {
  const lines = text.split(/\r?\n/);
  const domains = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {continue;}
    if (format === 'hosts') {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const domain = parts[1].toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
        if (domain && !domain.startsWith('#') && !/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
          domains.add(domain);
        }
      }
    } else {
      const domain = trimmed.replace(/^[|@]*/, '').toLowerCase().split('/')[0];
      if (domain && domain.includes('.')) {domains.add(domain);}
    }
  }
  return Array.from(domains);
}

async function fetchDomains(url: string, format: 'domains' | 'hosts'): Promise<string[]> {
  try {
    const res = await fetch(url, {headers: {'Cache-Control': 'no-cache'}});
    if (!res.ok) {return [];}
    const text = await res.text();
    return parseDomainsFromText(text, format);
  } catch (e) {
    console.warn('[BlacklistSync] Fetch failed:', url, e);
    return [];
  }
}

export async function syncBlacklist(): Promise<SyncStatus> {
  const manual = await getManualDomainLists();
  const whitelistSet = new Set(manual.whitelist.map(d => d.toLowerCase()));

  const [hagezi, stevenblack] = await Promise.all([
    fetchDomains(HAGEZI_URL, 'domains'),
    fetchDomains(STEVENBLACK_URL, 'hosts'),
  ]);

  const otaSet = new Set<string>();
  for (const d of hagezi) {otaSet.add(d);}
  for (const d of stevenblack) {otaSet.add(d);}

  const merged = new Set<string>([...otaSet, ...manual.blacklist]);
  for (const w of whitelistSet) {
    merged.delete(w);
    const toRemove: string[] = [];
    for (const m of merged) {
      if (m === w || m.endsWith('.' + w)) {toRemove.push(m);}
    }
    for (const r of toRemove) {merged.delete(r);}
  }
  const mergedArr = Array.from(merged);

  await AsyncStorage.setItem(OTA_DOMAINS_KEY, JSON.stringify(mergedArr));
  const meta: SyncStatus = {
    lastSyncAt: Date.now(),
    totalBlocked: mergedArr.length,
    lastError: null,
  };
  await AsyncStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  return meta;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_META_KEY);
    if (!raw) {
      const otaRaw = await AsyncStorage.getItem(OTA_DOMAINS_KEY);
      const arr = otaRaw ? JSON.parse(otaRaw) : [];
      return {lastSyncAt: null, totalBlocked: arr.length, lastError: null};
    }
    return JSON.parse(raw) as SyncStatus;
  } catch {
    return {lastSyncAt: null, totalBlocked: 0, lastError: null};
  }
}

/** Retorna a lista negra mergada (OTA + manual, menos whitelist). */
export async function getMergedBlacklist(): Promise<string[]> {
  const manual = await getManualDomainLists();
  const whitelistSet = new Set(manual.whitelist.map(d => d.toLowerCase()));

  let ota: string[] = [];
  try {
    const raw = await AsyncStorage.getItem(OTA_DOMAINS_KEY);
    if (raw) {ota = JSON.parse(raw);}
  } catch {
    // ignore
  }

  const merged = new Set<string>([...ota, ...manual.blacklist]);
  for (const w of whitelistSet) {
    merged.delete(w);
    const toRemove: string[] = [];
    for (const m of merged) {
      if (m.endsWith('.' + w)) {toRemove.push(m);}
    }
    for (const r of toRemove) {merged.delete(r);}
  }
  return Array.from(merged);
}
