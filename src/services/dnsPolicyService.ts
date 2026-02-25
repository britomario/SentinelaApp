import {getEnv} from './config/env';
import {DnsProfile} from './dnsProfiles';
import {captureHandledError} from './observability/sentry';

type DnsPolicySyncResponse = {
  ok: boolean;
  profile: DnsProfile;
};

export async function syncDnsPolicyForChild(
  childId: string,
  profile: DnsProfile,
): Promise<DnsProfile> {
  const baseUrl = getEnv('DNS_POLICY_API_BASE_URL') ?? getEnv('SYNC_API_BASE_URL');
  if (!baseUrl) {
    return profile;
  }

  try {
    const response = await fetch(`${baseUrl}/api/dns/profile-sync`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        childId,
        profile: {
          ...profile,
          lastSyncAt: Date.now(),
        },
      }),
    });
    if (!response.ok) {
      return profile;
    }
    const data = (await response.json()) as DnsPolicySyncResponse;
    if (!data.ok || !data.profile) {
      return profile;
    }
    return data.profile;
  } catch (error) {
    captureHandledError(error, 'dns_policy_sync');
    return profile;
  }
}
