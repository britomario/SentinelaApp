type RequestLike = {
  method?: string;
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
  const profile = req.body?.profile;
  if (!childId || !profile?.id) {
    res.status(400).json({error: 'invalid_payload'});
    return;
  }

  const normalized = {
    ...profile,
    lastSyncAt: Date.now(),
  };

  res.status(200).json({
    ok: true,
    childId,
    profile: normalized,
  });
}
