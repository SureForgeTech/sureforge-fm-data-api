import type { IntakeOutcome } from './intake-submission';

const MAX_REPLY_BYTES = 32768;

/** Server-only handoff. The extension binds the approved profile/layout and owns durable duplicate protection. */
export async function submitFileMakerRegistration(intakeId: string, submissionId: string, values: unknown,
  fetchFn: typeof fetch = fetch, environment: Readonly<Record<string, string | undefined>> = process.env): Promise<IntakeOutcome> {
  let endpoint: URL;
  try {
    endpoint = new URL(environment.FMWEB_BRIDGE_URL ?? '');
    if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port
      || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/fm') return { status: 'rejected' };
    // The bridge route is a protocol constant shared with the extension's bridge server.
    // It is not user-visible wording, so it keeps its name.
    endpoint.pathname += '/submitRegistration';
  } catch { return { status: 'rejected' }; }
  const token = environment.FMWEB_BRIDGE_TOKEN;
  if (!token || token.length > 4096) return { status: 'rejected' };
  try {
    const response = await fetchFn(endpoint.toString(), { method: 'POST', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:3000', 'X-FM-Bridge-Token': token },
      body: JSON.stringify({ intakeId, submissionId, values }), signal: AbortSignal.timeout(15000) });
    // These bridge refusals precede dispatch. Never expose its body or retry an uncertain write.
    if ([400, 401, 403, 404, 413, 415, 429].includes(response.status)) return { status: 'rejected' };
    if (response.status !== 200) return { status: 'uncertain' };
    const body = await boundedReply(response);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 'uncertain' };
    const result = body as Record<string, unknown>;
    if (result.status === 'accepted') return typeof result.receipt === 'string' && /^[a-z0-9-]{1,80}$/i.test(result.receipt)
      ? { status: 'accepted', receipt: result.receipt } : { status: 'uncertain' };
    if (result.status === 'invalid') return { status: 'invalid', errors: [{ code: 'value', message: 'Check the form fields before submitting again.' }] };
    if (result.status === 'pending' || result.status === 'uncertain' || result.status === 'rejected'
      || result.status === 'capacity' || result.status === 'conflict') return { status: result.status };
  } catch { /* A timeout or malformed reply cannot establish whether FileMaker committed the write. */ }
  return { status: 'uncertain' };
}

async function boundedReply(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No reply.');
  const chunks: Uint8Array[] = [];let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();if (done) break;
      length += value.length;
      if (length > MAX_REPLY_BYTES) throw new Error('Reply too large.');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset);offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } finally { await reader.cancel().catch(() => undefined); }
}
