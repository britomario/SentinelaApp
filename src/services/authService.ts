import {Linking} from 'react-native';
import {getSupabaseClient} from './supabaseClient';
import type {LinkedProvider} from './onboardingState';

type SupportedOAuthProvider = 'google' | 'apple' | 'facebook';
const AUTH_CALLBACK_PREFIX = 'sentinela://auth/callback';

export async function signInWithProvider(provider: LinkedProvider): Promise<boolean> {
  if (provider === 'manual') {
    return true;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const oauthProvider = provider as SupportedOAuthProvider;
  const redirectTo = 'sentinela://auth/callback';
  const result = await supabase.auth.signInWithOAuth({
    provider: oauthProvider,
    options: {redirectTo, skipBrowserRedirect: true},
  });

  const authUrl = result.data?.url;
  if (!authUrl) {
    return false;
  }
  await Linking.openURL(authUrl);
  return true;
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
      result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue ?? '');
    });
  return result;
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return url.startsWith(AUTH_CALLBACK_PREFIX);
}

export async function completeAuthFromCallbackUrl(url: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !isAuthCallbackUrl(url)) {
    return false;
  }

  const params = parseAuthParamsFromUrl(url);
  const code = params.code;
  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) {
      return false;
    }
  } else {
    const accessToken = params.access_token;
    const refreshToken = params.refresh_token;
    if (!accessToken || !refreshToken) {
      return false;
    }
    const sessionResult = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionResult.error) {
      return false;
    }
  }

  const user = await supabase.auth.getUser();
  return !!user.data.user?.id;
}

export async function waitForAuthenticatedSession(timeoutMs = 20000): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    if (userId) {
      return true;
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
  const response = await supabase.auth.getUser();
  return response.data.user?.id ?? null;
}
