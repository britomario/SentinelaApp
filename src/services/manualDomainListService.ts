import AsyncStorage from '@react-native-async-storage/async-storage';

const MANUAL_LIST_KEY = '@sentinela/manual_domain_lists';

const DEFAULT_KEYWORDS = [
  'bet',
  'porn',
  'xxx',
  'casino',
  'apostas',
  'onlyfans',
  'pornhub',
  'xvideos',
  'xnxx',
];

export type ManualDomainLists = {
  blacklist: string[];
  whitelist: string[];
  keywords: string[];
};

const EMPTY_LISTS: ManualDomainLists = {
  blacklist: [],
  whitelist: [],
  keywords: [],
};

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*/, '');
}

export async function getManualDomainLists(): Promise<ManualDomainLists> {
  const raw = await AsyncStorage.getItem(MANUAL_LIST_KEY);
  if (!raw) {
    return EMPTY_LISTS;
  }
  try {
    const parsed = JSON.parse(raw) as ManualDomainLists;
    return {
      blacklist: Array.isArray(parsed.blacklist)
        ? parsed.blacklist.filter(Boolean)
        : [],
      whitelist: Array.isArray(parsed.whitelist)
        ? parsed.whitelist.filter(Boolean)
        : [],
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter(Boolean)
        : [],
    };
  } catch {
    return EMPTY_LISTS;
  }
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

async function saveLists(lists: ManualDomainLists): Promise<ManualDomainLists> {
  const next = {
    blacklist: Array.from(new Set(lists.blacklist.map(normalizeDomain).filter(Boolean))),
    whitelist: Array.from(new Set(lists.whitelist.map(normalizeDomain).filter(Boolean))),
    keywords: Array.from(
      new Set(lists.keywords.map(normalizeKeyword).filter(Boolean)),
    ),
  };
  await AsyncStorage.setItem(MANUAL_LIST_KEY, JSON.stringify(next));
  return next;
}

export async function addDomainToList(
  domainInput: string,
  target: 'blacklist' | 'whitelist',
): Promise<ManualDomainLists> {
  const domain = normalizeDomain(domainInput);
  if (!domain) {
    return getManualDomainLists();
  }
  const current = await getManualDomainLists();
  const opposite = target === 'blacklist' ? 'whitelist' : 'blacklist';
  return saveLists({
    ...current,
    [target]: [...current[target], domain],
    [opposite]: current[opposite].filter(item => item !== domain),
  });
}

export async function removeDomainFromList(
  domainInput: string,
  target: 'blacklist' | 'whitelist',
): Promise<ManualDomainLists> {
  const domain = normalizeDomain(domainInput);
  const current = await getManualDomainLists();
  return saveLists({
    ...current,
    [target]: current[target].filter(item => item !== domain),
  });
}

export async function addKeyword(keyword: string): Promise<ManualDomainLists> {
  const k = normalizeKeyword(keyword);
  if (!k) {return getManualDomainLists();}
  const current = await getManualDomainLists();
  if (current.keywords.includes(k)) {return current;}
  return saveLists({
    ...current,
    keywords: [...current.keywords, k],
  });
}

export async function removeKeyword(keyword: string): Promise<ManualDomainLists> {
  const k = normalizeKeyword(keyword);
  const current = await getManualDomainLists();
  return saveLists({
    ...current,
    keywords: current.keywords.filter(item => item !== k),
  });
}

/** Retorna keywords efetivas: padrao + manuais (sem duplicatas, normalizadas como no nativo). */
export function getEffectiveKeywords(manualKeywords: string[]): string[] {
  const normalized = manualKeywords.map(normalizeKeyword).filter(Boolean);
  const set = new Set<string>([...DEFAULT_KEYWORDS, ...normalized]);
  return Array.from(set);
}
