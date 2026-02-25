/**
 * Catálogo central de ícones oficiais de apps com URLs versionadas, fallback e cache.
 */

const CDN_BASE = 'https://www.google.com/s2/favicons';
const SIZE = 128;

const FALLBACK_ICONS: Record<string, string> = {
  youtube: '▶️',
  netflix: '🎬',
  duolingo: '🦉',
  roblox: '🎮',
  minecraft: '⛏️',
  tiktok: '🎵',
  instagram: '📷',
  whatsapp: '💬',
  chrome: '🌐',
  games: '🎮',
  jogos: '🎮',
};

export type AppIconEntry = {
  id: string;
  name: string;
  iconUrl: string;
  fallback: string;
  domain?: string;
  packageName?: string;
};

const APP_CATALOG: AppIconEntry[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    iconUrl: `${CDN_BASE}?domain=youtube.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.youtube,
    domain: 'youtube.com',
    packageName: 'com.google.android.youtube',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    iconUrl: `${CDN_BASE}?domain=netflix.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.netflix,
    domain: 'netflix.com',
    packageName: 'com.netflix.mediaclient',
  },
  {
    id: 'duolingo',
    name: 'Duolingo',
    iconUrl: `${CDN_BASE}?domain=duolingo.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.duolingo,
    domain: 'duolingo.com',
    packageName: 'com.duolingo',
  },
  {
    id: 'roblox',
    name: 'Roblox',
    iconUrl: `${CDN_BASE}?domain=roblox.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.roblox,
    domain: 'roblox.com',
    packageName: 'com.roblox.client',
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    iconUrl: `${CDN_BASE}?domain=minecraft.net&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.minecraft,
    domain: 'minecraft.net',
    packageName: 'com.mojang.minecraftpe',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    iconUrl: `${CDN_BASE}?domain=tiktok.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.tiktok,
    domain: 'tiktok.com',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    iconUrl: `${CDN_BASE}?domain=instagram.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.instagram,
    domain: 'instagram.com',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    iconUrl: `${CDN_BASE}?domain=whatsapp.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.whatsapp,
    domain: 'whatsapp.com',
  },
  {
    id: 'chrome',
    name: 'Chrome',
    iconUrl: `${CDN_BASE}?domain=google.com&sz=${SIZE}`,
    fallback: FALLBACK_ICONS.chrome,
    domain: 'google.com',
  },
];

export function getAppIcon(name: string): AppIconEntry | undefined {
  const key = name.toLowerCase().replace(/\s+/g, '');
  return APP_CATALOG.find(
    e =>
      e.id === key ||
      e.name.toLowerCase() === name.toLowerCase() ||
      e.name.toLowerCase().includes(name.toLowerCase()),
  );
}

export function getAppIconByPackageName(packageName: string): AppIconEntry | undefined {
  return APP_CATALOG.find(e => e.packageName === packageName);
}

/** Cria AppIconEntry para app arbitrário (instalado no dispositivo) */
export function toAppIconEntry(packageName: string, label: string, iconUri?: string): AppIconEntry {
  const known = getAppIconByPackageName(packageName) ?? getAppIcon(label);
  const id = packageName.replace(/\./g, '_');
  const base = known ?? {
    id,
    name: label,
    iconUrl: `https://www.google.com/s2/favicons?domain=${packageName}&sz=128`,
    fallback: getAppIconFallback(label),
    packageName,
  };
  if (iconUri) {
    return { ...base, iconUrl: iconUri };
  }
  return base;
}

export function getAppIconUrl(name: string): string | null {
  const entry = getAppIcon(name);
  return entry?.iconUrl ?? null;
}

export function getAppIconFallback(name: string): string {
  const entry = getAppIcon(name);
  const key = name.toLowerCase().replace(/\s+/g, '');
  return entry?.fallback ?? FALLBACK_ICONS[key] ?? FALLBACK_ICONS.games ?? '📱';
}

export function getCatalog(): ReadonlyArray<AppIconEntry> {
  return APP_CATALOG;
}

export function getCatalogForChildMode(): AppIconEntry[] {
  return [
    getAppIcon('youtube') ?? {
      id: 'youtube',
      name: 'YouTube',
      iconUrl: '',
      fallback: '▶️',
      packageName: 'com.google.android.youtube',
    },
    getAppIcon('duolingo') ?? {
      id: 'duolingo',
      name: 'Duolingo',
      iconUrl: '',
      fallback: '🦉',
      packageName: 'com.duolingo',
    },
    getAppIcon('netflix') ?? {
      id: 'netflix',
      name: 'Netflix',
      iconUrl: '',
      fallback: '🎬',
      packageName: 'com.netflix.mediaclient',
    },
    {
      id: 'games',
      name: 'Jogos',
      iconUrl: '',
      fallback: '🎮',
    },
  ].filter((e): e is AppIconEntry => !!e);
}
