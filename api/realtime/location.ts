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

const memoryStore: Record<string, LocationPayload> = {};

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (req.method === 'GET') {
    const childId = req.query?.childId;
    if (!childId) {
      res.status(400).json({error: 'child_id_required'});
      return;
    }
    res.status(200).json(memoryStore[childId] ?? null);
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

  memoryStore[payload.childId] = payload;
  res.status(200).json({ok: true});
}
