type RequestLike = {
  method?: string;
  body?: Record<string, unknown>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
};

import {getSupabaseServerClient} from '../_supabaseServer';

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'method_not_allowed'});
    return;
  }

  const parentId = typeof req.body?.parentId === 'string' ? req.body.parentId.trim() : null;
  const childId = typeof req.body?.childId === 'string' ? req.body.childId.trim() : null;
  const alias = typeof req.body?.alias === 'string' ? req.body.alias.trim() || null : null;

  if (!parentId || !childId) {
    res.status(400).json({error: 'parent_id_and_child_id_required'});
    return;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    res.status(500).json({error: 'supabase_not_configured'});
    return;
  }

  const {error} = await supabase.from('family_children').upsert(
    {
      parent_id: parentId,
      child_id: childId,
      alias: alias ?? null,
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'parent_id,child_id'},
  );

  if (error) {
    res.status(500).json({error: 'pairing_register_failed', message: error.message});
    return;
  }

  res.status(200).json({ok: true, parentId, childId, alias});
}
