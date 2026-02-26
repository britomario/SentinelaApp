type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: any) => void;
};

import {getSupabaseServerClient} from '../_supabaseServer';

function getHeaderValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string {
  if (!headers) {
    return '';
  }
  const direct = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
  if (Array.isArray(direct)) {
    return direct[0] ?? '';
  }
  return direct ?? '';
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'method_not_allowed'});
    return;
  }

  const expectedBearerToken = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expectedBearerToken) {
    res.status(500).json({error: 'missing_webhook_secret'});
    return;
  }

  const authorization = getHeaderValue(req.headers, 'authorization');
  const expectedAuthorization = `Bearer ${expectedBearerToken}`;
  if (authorization !== expectedAuthorization) {
    res.status(401).json({error: 'invalid_authorization'});
    return;
  }

  const event = req.body?.event ?? req.body ?? {};
  const eventType = String(event.type ?? '').toUpperCase();

  if (eventType === 'TEST') {
    res.status(200).json({
      ok: true,
      processed: false,
      ignored_reason: 'test_event',
      event_type: eventType,
    });
    return;
  }

  if (eventType !== 'INITIAL_PURCHASE' && eventType !== 'RENEWAL') {
    res.status(200).json({
      ok: true,
      processed: false,
      ignored_reason: 'unsupported_event_type',
      event_type: eventType || null,
      app_user_id: event.app_user_id ?? null,
    });
    return;
  }

  const appUserId = event.app_user_id ?? null;
  const entitlement = event.entitlement_ids?.[0] ?? null;

  const supabase = getSupabaseServerClient();
  if (supabase && appUserId) {
    await supabase.from('family_premium_state').upsert(
      {
        parent_id: appUserId,
        active: true,
        source: 'revenuecat',
        entitlement_id: entitlement,
        updated_at: new Date().toISOString(),
      },
      {onConflict: 'parent_id'},
    );
  }

  res.status(200).json({
    ok: true,
    processed: true,
    event_type: eventType,
    app_user_id: appUserId,
    entitlement_id: entitlement,
  });
}
