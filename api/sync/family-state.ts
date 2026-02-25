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

  // Placeholder shape for app sync.
  res.status(200).json({
    parentId,
    premium: {
      active: false,
      source: 'revenuecat',
    },
    children: [],
    pairing: {
      latestTokenStatus: 'unknown',
    },
  });
}
