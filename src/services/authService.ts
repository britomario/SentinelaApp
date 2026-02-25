import {Linking} from 'react-native';
import {getSupabaseClient} from './supabaseClient';
import type {LinkedProvider} from './onboardingState';

type SupportedOAuthProvider = 'google' | 'apple';

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

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const response = await supabase.auth.getUser();
  return response.data.user?.id ?? null;
}
