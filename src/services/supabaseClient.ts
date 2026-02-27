import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {getEnv} from './config/env';

let supabaseInstance: SupabaseClient | null = null;
let lastUnavailableReason: string | null = null;

function isSupabaseUrlValid(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) {return false;}
  if (trimmed.includes('/auth/v1/callback') || trimmed.includes('/auth/v1/')) {
    return false;
  }
  if (!trimmed.includes('.supabase.co')) {return false;}
  return true;
}

export function getSupabaseUnavailableReason(): string | null {
  return lastUnavailableReason;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  lastUnavailableReason = null;

  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    lastUnavailableReason = 'supabase_client_unavailable';
    return null;
  }
  if (!isSupabaseUrlValid(supabaseUrl)) {
    lastUnavailableReason = 'supabase_env_invalid';
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage as unknown as Storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // OAuth mobile: detectSessionInUrl=false; we handle callback via Linking and exchangeCodeForSession in authService.
  return supabaseInstance;
}
