import {getSupabaseServerClient} from '../_supabaseServer';

type RequestLike = {
  method?: string;
  body?: any;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: any) => void;
};

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'method_not_allowed'});
    return;
  }

  const childId = req.body?.childId;
  const profile = req.body?.profile;
  if (!childId || !profile?.id) {
    res.status(400).json({error: 'invalid_payload'});
    return;
  }

  const normalized = normalizeProfile(profile);
  if (normalized.provider === 'nextdns') {
    await syncNextDnsProfile(normalized).catch(() => undefined);
  }

  await persistDnsPolicy(childId, normalized).catch(() => undefined);

  res.status(200).json({
    ok: true,
    childId,
    profile: {
      ...normalized,
      lastSyncAt: Date.now(),
    },
  });
}

function normalizeProfile(profile: Record<string, unknown>) {
  const nextDnsProfileId =
    process.env.NEXTDNS_PROFILE_ID ||
    (typeof profile.profileId === 'string' ? profile.profileId : '');
  const isNextDns = profile.provider === 'nextdns';
  const dotHost =
    isNextDns && nextDnsProfileId
      ? `${nextDnsProfileId}.dns.nextdns.io`
      : String(profile.dotHost ?? '');
  const dohUrl =
    isNextDns && nextDnsProfileId
      ? `https://dns.nextdns.io/${nextDnsProfileId}`
      : typeof profile.dohUrl === 'string'
        ? profile.dohUrl
        : '';

  return {
    ...profile,
    profileId: nextDnsProfileId || profile.profileId,
    dotHost,
    dohUrl,
    lastSyncAt: Date.now(),
  };
}

async function syncNextDnsProfile(
  profile: ReturnType<typeof normalizeProfile>,
): Promise<void> {
  const apiKey = process.env.NEXTDNS_API_KEY;
  const profileId = String(profile.profileId ?? '');
  if (!apiKey || !profileId) {
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  };

  const patchProfile = async (path: string, body: Record<string, unknown>) => {
    await fetch(`https://api.nextdns.io/profiles/${profileId}/${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
  };

  await patchProfile('settings/security', {
    aiThreatDetection: true,
    cryptojacking: true,
    domainGenerationAlgorithms: true,
    typosquatting: true,
  }).catch(() => undefined);

  await patchProfile('parentalcontrol', {
    enabled: true,
    safeSearch: true,
    youtubeRestrictedMode: 'moderate',
    blockBypassMethods: true,
  }).catch(() => undefined);

  await patchProfile('denylist', {
    id: 'sentinela-family-risk',
    active: true,
    domains: [
      'bet365.com',
      'betano.com',
      'pixbet.com',
      'pornhub.com',
      'xvideos.com',
      'xnxx.com',
    ],
  }).catch(() => undefined);
}

async function persistDnsPolicy(
  childId: string,
  profile: ReturnType<typeof normalizeProfile>,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase.from('child_dns_policy').upsert(
    {
      child_id: childId,
      provider: profile.provider ?? null,
      profile_id: profile.profileId ?? null,
      dot_host: profile.dotHost ?? null,
      doh_url: profile.dohUrl ?? null,
      policy_tags: Array.isArray(profile.policyTags) ? profile.policyTags : [],
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'child_id'},
  );
}
