import {Linking, Platform} from 'react-native';

import {captureHandledError} from './observability/sentry';
import {getSupabaseClient, getSupabaseUnavailableReason} from './supabaseClient';
import type {LinkedProvider} from './onboardingState';

type SupportedOAuthProvider = 'google' | 'apple' | 'facebook';

export type AuthOperationResult = {
  ok: boolean;
  code?: string;
  message?: string;
};

const AUTH_CALLBACK_PREFIX = 'sentinela://auth/callback';

function asSupportedProvider(provider: LinkedProvider): SupportedOAuthProvider | null {
  if (provider === 'google' || provider === 'apple' || provider === 'facebook') {
    return provider;
  }
  return null;
}

export async function signInWithProvider(
  provider: LinkedProvider,
): Promise<AuthOperationResult> {
  if (provider === 'manual') {
    return {ok: true};
  }

  const oauthProvider = asSupportedProvider(provider);
  if (!oauthProvider) {
    return {ok: false, code: 'oauth_provider_not_supported'};
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    const reason = getSupabaseUnavailableReason();
    return {
      ok: false,
      code: reason ?? 'supabase_client_unavailable',
    };
  }

  try {
    const result = await supabase.auth.signInWithOAuth({
      provider: oauthProvider,
      options: {redirectTo: AUTH_CALLBACK_PREFIX, skipBrowserRedirect: true},
    });

    if (result.error) {
      captureHandledError(
        new Error(`OAuth start failed: ${result.error.message}`),
        `auth_oauth_start_failed_${oauthProvider}`,
      );
      return {
        ok: false,
        code: 'oauth_start_failed',
        message: result.error.message,
      };
    }

    const authUrl = result.data?.url;
    if (!authUrl || typeof authUrl !== 'string' || !authUrl.startsWith('http')) {
      captureHandledError(
        new Error('OAuth URL missing or invalid'),
        `auth_oauth_url_missing_${oauthProvider}`,
      );
      return {ok: false, code: 'oauth_url_missing'};
    }

    if (Platform.OS === 'android') {
      try {
        const canOpen = await Linking.canOpenURL(authUrl);
        if (!canOpen) {
          captureHandledError(
            new Error('No app can handle OAuth URL'),
            `auth_oauth_cannot_open_${oauthProvider}`,
          );
          return {
            ok: false,
            code: 'oauth_open_url_failed',
            message: 'Nenhum navegador pode abrir a tela de login.',
          };
        }
      } catch {
        // canOpenURL can throw on some devices; proceed with openURL
      }
    }

    await Linking.openURL(authUrl);
    return {ok: true};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    captureHandledError(error, `auth_oauth_open_url_failed_${oauthProvider}`);
    return {
      ok: false,
      code: 'oauth_open_url_failed',
      message,
    };
  }
}

function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const normalized = url.replace('#', '?');
  const query = normalized.includes('?') ? normalized.split('?')[1] : '';
  const result: Record<string, string> = {};
  query
    .split('&')
    .filter(Boolean)
    .forEach(entry => {
      const [rawKey, rawValue] = entry.split('=');
      if (!rawKey) {
        return;
      }
      try {
        result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue ?? '');
      } catch {
        result[rawKey] = rawValue ?? '';
      }
    });
  return result;
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return url.startsWith(AUTH_CALLBACK_PREFIX);
}

export async function completeAuthFromCallbackUrl(
  url: string,
): Promise<AuthOperationResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const reason = getSupabaseUnavailableReason();
    return {
      ok: false,
      code: reason ?? 'supabase_client_unavailable',
    };
  }
  if (!isAuthCallbackUrl(url)) {
    return {ok: false, code: 'oauth_callback_invalid'};
  }

  const params = parseAuthParamsFromUrl(url);

  // Provider-level OAuth errors arrive in callback query/fragment.
  if (params.error) {
    return {
      ok: false,
      code:
        params.error === 'access_denied'
          ? 'oauth_cancelled_by_user'
          : 'oauth_provider_error',
      message: params.error_description || params.error,
    };
  }

  const code = params.code;
  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) {
      captureHandledError(
        new Error(`OAuth code exchange failed: ${exchanged.error.message}`),
        'auth_oauth_code_exchange_failed',
      );
      return {
        ok: false,
        code: 'oauth_code_exchange_failed',
        message: exchanged.error.message,
      };
    }
  } else {
    const accessToken = params.access_token;
    const refreshToken = params.refresh_token;
    if (!accessToken || !refreshToken) {
      captureHandledError(
        new Error('OAuth callback missing tokens'),
        'auth_oauth_callback_tokens_missing',
      );
      return {ok: false, code: 'oauth_callback_tokens_missing'};
    }
    const sessionResult = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionResult.error) {
      captureHandledError(
        new Error(`OAuth set session failed: ${sessionResult.error.message}`),
        'auth_oauth_set_session_failed',
      );
      return {
        ok: false,
        code: 'oauth_set_session_failed',
        message: sessionResult.error.message,
      };
    }
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user?.id) {
    captureHandledError(new Error('OAuth user unavailable after callback'), 'auth_oauth_user_unavailable');
    return {ok: false, code: 'oauth_user_unavailable'};
  }
  return {ok: true};
}

export async function waitForAuthenticatedSession(timeoutMs = 20000): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id;
      if (userId) {
        return true;
      }
    } catch {
      // Keep polling until timeout.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  try {
    const response = await supabase.auth.getUser();
    return response.data.user?.id ?? null;
  } catch {
    return null;
  }
}
