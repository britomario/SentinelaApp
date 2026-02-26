import {getEnv} from './config/env';
import {getAuthenticatedUserId} from './authService';
import {captureHandledError} from './observability/sentry';

export type RegisterPairingResult =
  | {ok: true}
  | {ok: false; reason: 'api_not_configured' | 'parent_not_authenticated' | 'network_error' | string};

export async function registerPairingOnServer(
  childId: string,
  alias?: string,
): Promise<RegisterPairingResult> {
  const apiBase = getEnv('SYNC_API_BASE_URL');
  if (!apiBase) {
    return {ok: false, reason: 'api_not_configured'};
  }

  const parentId = await getAuthenticatedUserId().catch(() => null);
  if (!parentId) {
    return {ok: false, reason: 'parent_not_authenticated'};
  }

  try {
    const response = await fetch(`${apiBase}/api/pairing/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({parentId, childId, alias: alias ?? null}),
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      captureHandledError(
        new Error(`Pairing register failed: ${response.status}`),
        'pairing_register',
      );
      return {
        ok: false,
        reason: data.error ?? data.message ?? `http_${response.status}`,
      };
    }

    if (data.ok !== true) {
      return {ok: false, reason: data.error ?? 'register_failed'};
    }

    return {ok: true};
  } catch (error) {
    captureHandledError(error, 'pairing_register');
    return {ok: false, reason: 'network_error'};
  }
}
