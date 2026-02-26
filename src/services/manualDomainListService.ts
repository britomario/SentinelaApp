import AsyncStorage from '@react-native-async-storage/async-storage';

const MANUAL_LIST_KEY = '@sentinela/manual_domain_lists';

export type ManualDomainLists = {
  blacklist: string[];
  whitelist: string[];
};

const EMPTY_LISTS: ManualDomainLists = {
  blacklist: [],
  whitelist: [],
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
    };
  } catch {
    return EMPTY_LISTS;
  }
}

async function saveLists(lists: ManualDomainLists): Promise<ManualDomainLists> {
  const next = {
    blacklist: Array.from(new Set(lists.blacklist.map(normalizeDomain).filter(Boolean))),
    whitelist: Array.from(new Set(lists.whitelist.map(normalizeDomain).filter(Boolean))),
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
