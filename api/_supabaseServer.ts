import {createClient} from '@supabase/supabase-js';

type SupabaseServerClient = ReturnType<typeof createClient> | null;

let cachedClient: SupabaseServerClient = null;

export function getSupabaseServerClient(): SupabaseServerClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}
