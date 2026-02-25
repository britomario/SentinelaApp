type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  query?: Record<string, string | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: any) => void;
};

import {getSupabaseServerClient} from '../_supabaseServer';

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({error: 'method_not_allowed'});
    return;
  }

  const parentId = req.query?.parentId;
  if (!parentId) {
    res.status(400).json({error: 'parent_id_required'});
    return;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    res.status(500).json({error: 'supabase_not_configured'});
    return;
  }

  const {data: childrenRows} = await supabase
    .from('family_children')
    .select('child_id, alias, status')
    .eq('parent_id', parentId)
    .order('updated_at', {ascending: false});

  const children = (childrenRows ?? []).map((row: any) => ({
    childId: row.child_id,
    alias: row.alias ?? null,
    status: row.status ?? 'active',
  }));

  const {data: premiumRow} = await supabase
    .from('family_premium_state')
    .select('active, source')
    .eq('parent_id', parentId)
    .maybeSingle();

  const {data: pairingRow} = await supabase
    .from('family_pairing_state')
    .select('latest_token_status')
    .eq('parent_id', parentId)
    .maybeSingle();

  res.status(200).json({
    parentId,
    premium: {
      active: Boolean(premiumRow?.active),
      source: premiumRow?.source ?? 'revenuecat',
    },
    children,
    pairing: {
      latestTokenStatus: pairingRow?.latest_token_status ?? 'unknown',
    },
  });
}
