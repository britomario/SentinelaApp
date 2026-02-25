export type DnsMode = 'light' | 'advanced';

export type DnsProfile = {
  id: string;
  name: string;
  description: string;
  provider: 'cleanbrowsing' | 'nextdns' | 'adguard' | 'cloudflare';
  profileId?: string;
  policyTags: string[];
  lastSyncAt?: number;
  dotHost: string;
  dohUrl?: string;
  fallbackDnsIp: string;
};

export const DNS_PROFILES: DnsProfile[] = [
  {
    id: 'nextdns-family',
    name: 'NextDNS Family',
    description:
      'Perfil recomendado com bloqueio de adulto, apostas, malware e risco.',
    provider: 'nextdns',
    profileId: 'NEXTDNS_PROFILE',
    policyTags: ['adult', 'gambling', 'malware', 'suspicious'],
    dotHost: 'NEXTDNS_PROFILE.dns.nextdns.io',
    dohUrl: 'https://dns.nextdns.io/NEXTDNS_PROFILE',
    fallbackDnsIp: '45.90.28.0',
  },
  {
    id: 'adguard-family',
    name: 'AdGuard Family',
    description: 'Filtro familiar com bloqueio de conteúdo adulto e anúncios.',
    provider: 'adguard',
    policyTags: ['adult', 'gambling', 'malware'],
    dotHost: 'dns-family.adguard.com',
    dohUrl: 'https://dns-family.adguard.com/dns-query',
    fallbackDnsIp: '94.140.14.15',
  },
  {
    id: 'cloudflare-family',
    name: 'Cloudflare Families',
    description: 'Perfil rápido com proteção para malware e conteúdo adulto.',
    provider: 'cloudflare',
    policyTags: ['adult', 'malware'],
    dotHost: 'family.cloudflare-dns.com',
    dohUrl: 'https://family.cloudflare-dns.com/dns-query',
    fallbackDnsIp: '1.1.1.3',
  },
  {
    id: 'opendns-familyshield',
    name: 'OpenDNS FamilyShield',
    description: 'Perfil familiar tradicional para redes compartilhadas.',
    provider: 'cleanbrowsing',
    profileId: 'family-default',
    policyTags: ['adult', 'proxy-vpn', 'malware', 'gambling'],
    dotHost: 'familyshield.opendns.com',
    dohUrl: 'https://doh.familyshield.opendns.com/dns-query',
    fallbackDnsIp: '208.67.222.123',
  },
];

export function getDnsProfile(profileId: string): DnsProfile {
  return DNS_PROFILES.find(p => p.id === profileId) ?? DNS_PROFILES[0];
}
