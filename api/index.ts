type RequestLike = {
  method?: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
};

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({error: 'method_not_allowed'});
    return;
  }

  res.status(200).json({
    ok: true,
    message: 'API Online',
  });
}
