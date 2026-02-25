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

  const childId = req.body?.childId;
  const title = req.body?.title;
  const message = req.body?.message;
  const action = req.body?.action as string | undefined;
  if (!childId || !title || !message) {
    res.status(400).json({error: 'invalid_payload'});
    return;
  }

  const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;
  const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
  if (!oneSignalApiKey || !oneSignalAppId) {
    res.status(200).json({
      ok: false,
      reason: 'onesignal_not_configured',
    });
    return;
  }

  const payload: Record<string, unknown> = {
    app_id: oneSignalAppId,
    headings: {en: title},
    contents: {en: message},
    filters: [{field: 'tag', key: 'child_id', relation: '=', value: String(childId)}],
  };
  if (action) {
    payload.data = {action, childId};
  }

  const dispatchResponse = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${oneSignalApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!dispatchResponse.ok) {
    res.status(502).json({ok: false, reason: 'onesignal_dispatch_failed'});
    return;
  }

  res.status(200).json({ok: true});
}
