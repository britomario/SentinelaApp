import {getAuthenticatedUserId} from './authService';
import {getOrCreateDeviceId} from './deviceIdService';
import {getChildPairingConfig} from './pairingService';

/**
 * Resolve a stable identifier for the monitored child device/session.
 * Priority: authenticated user -> pairing token fingerprint -> device id.
 */
export async function getCurrentChildId(): Promise<string> {
  const userId = await getAuthenticatedUserId().catch(() => null);
  if (userId) {
    return userId;
  }

  const pairing = await getChildPairingConfig().catch(() => null);
  if (pairing?.pairToken) {
    return `pair-${pairing.pairToken.slice(0, 12)}`;
  }

  return getOrCreateDeviceId();
}
