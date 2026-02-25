type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: any) => void;
};

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'method_not_allowed'});
    return;
  }

  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const incomingSecret =
    (req.headers?.['x-revenuecat-signature'] as string | undefined) ?? '';
  if (expectedSecret && incomingSecret !== expectedSecret) {
    res.status(401).json({error: 'invalid_signature'});
    return;
  }

  const event = req.body?.event ?? req.body ?? {};
  const appUserId = event.app_user_id ?? null;
  const entitlement = event.entitlement_ids?.[0] ?? null;
  const status = event.type?.toLowerCase?.().includes('cancel')
    ? 'inactive'
    : 'active';

  res.status(200).json({
    ok: true,
    mapped: {
      appUserId,
      entitlement,
      status,
    },
  });
}
