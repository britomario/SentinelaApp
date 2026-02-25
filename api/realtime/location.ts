type RequestLike = {
  method?: string;
  body?: any;
  query?: Record<string, string | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: any) => void;
};

type LocationPayload = {
  childId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
};

import {getSupabaseServerClient} from '../_supabaseServer';

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    res.status(500).json({error: 'supabase_not_configured'});
    return;
  }

  if (req.method === 'GET') {
    const childId = req.query?.childId;
    if (!childId) {
      res.status(400).json({error: 'child_id_required'});
      return;
    }
    const {data, error} = await supabase
      .from('child_location_state')
      .select('child_id, latitude, longitude, accuracy, timestamp')
      .eq('child_id', childId)
      .maybeSingle();
    if (error) {
      res.status(500).json({error: 'location_fetch_failed'});
      return;
    }
    if (!data) {
      res.status(200).json(null);
      return;
    }
    res.status(200).json({
      childId: data.child_id,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      accuracy:
        data.accuracy === null || data.accuracy === undefined
          ? undefined
          : Number(data.accuracy),
      timestamp: Number(data.timestamp),
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({error: 'method_not_allowed'});
    return;
  }

  const payload = req.body as LocationPayload;
  if (!payload?.childId || !payload?.timestamp) {
    res.status(400).json({error: 'invalid_payload'});
    return;
  }

  const {error} = await supabase.from('child_location_state').upsert(
    {
      child_id: payload.childId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy ?? null,
      timestamp: payload.timestamp,
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'child_id'},
  );
  if (error) {
    res.status(500).json({error: 'location_upsert_failed'});
    return;
  }
  res.status(200).json({ok: true});
}
