import {captureHandledError} from './observability/sentry';

type ResolveResult = {
  blocked: boolean;
  answers: string[];
};

export async function resolveDomainWithDoh(
  dohUrl: string,
  domain: string,
): Promise<ResolveResult> {
  if (!dohUrl || !domain) {
    return {blocked: false, answers: []};
  }

  try {
    const queryUrl = `${dohUrl}?name=${encodeURIComponent(domain)}&type=A`;
    const response = await fetch(queryUrl, {
      headers: {accept: 'application/dns-json'},
    });
    if (!response.ok) {
      return {blocked: false, answers: []};
    }
    const payload = (await response.json()) as {
      Status?: number;
      Answer?: Array<{data?: string}>;
    };
    const answers = (payload.Answer ?? [])
      .map(item => item.data ?? '')
      .filter(Boolean);
    return {
      blocked: payload.Status !== 0 || answers.length === 0,
      answers,
    };
  } catch (error) {
    captureHandledError(error, 'doh_resolve_error');
    return {blocked: false, answers: []};
  }
}
