import {getAuthenticatedUserId} from './authService';
import {getOrCreateDeviceId} from './deviceIdService';
import {
  deriveChildIdFromPairToken,
  getChildPairingConfig,
  getParentPairingToken,
  getSelectedChildId,
} from './pairingService';

/**
 * Resolve a stable identifier for the monitored child device/session.
 * - On CHILD device (no auth): returns pair-XXX from pairing config, else device id.
 * - On PARENT device (auth): returns selected child or child from last pairing token, else userId (fallback).
 */
export async function getCurrentChildId(): Promise<string> {
  const userId = await getAuthenticatedUserId().catch(() => null);

  if (userId) {
    // Parent context: use child id for subscription/dispatch (must match child's published id)
    const selected = await getSelectedChildId().catch(() => null);
    if (selected) {
      return selected;
    }
    const parentToken = await getParentPairingToken().catch(() => null);
    if (parentToken) {
      return deriveChildIdFromPairToken(parentToken);
    }
    return userId;
  }

  // Child context: use pairing-derived id (child publishes location with this)
  const pairing = await getChildPairingConfig().catch(() => null);
  if (pairing?.pairToken) {
    return deriveChildIdFromPairToken(pairing.pairToken);
  }

  return getOrCreateDeviceId();
}
