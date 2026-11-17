import type { NextRequest } from 'next/server';
import { previewIntakes } from '../../../../lib/intake-registry';
import { createSyntheticIntakeAdapter, IntakeSubmissionService, type IntakeOutcome } from '../../../../lib/intake-submission';
import { submitFileMakerRegistration } from '../../../../lib/filemaker-intake-adapter';
import { previewHostAllowed, previewSessionAllowed } from '../../../../lib/preview-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const services = new Map<string, IntakeSubmissionService>();
const reply = (value: object, status: number) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!previewHostAllowed(request)) return reply({ error: 'Preview Host is not allowed.' }, 403);
  if (!previewSessionAllowed(request)) return reply({ error: 'Preview session is required.' }, 401);
  if (request.headers.get('origin') !== `http://${request.headers.get('host')}`) return reply({ error: 'Origin is not allowed.' }, 403);
  const { id } = await context.params;
  const example = await previewIntakes.load(id);
  if (!example) return reply({ error: 'Unknown or invalid registration form.' }, 404);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({ error: 'Use a JSON submission.' }, 415);
  let body = '';
  const reader = request.body?.getReader();
  try {
    if (reader) {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let length = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 32768) { await reader.cancel().catch(() => undefined); return reply({ error: 'Submission is too large.' }, 413); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    }
    const input: unknown = JSON.parse(body);
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some((key) => !['submissionId', 'values'].includes(key))) return reply({ error: 'Invalid submission.' }, 400);
    const submission = input as { submissionId?: unknown; values?: unknown };
    if (typeof submission.submissionId !== 'string') return reply({ error: 'Invalid submission.' }, 400);
    let outcome: IntakeOutcome;
    if (process.env.FMWEB_REGISTRATION_MODE === 'filemaker') {
      outcome = await submitFileMakerRegistration(id, submission.submissionId, submission.values);
    } else {
      let service = services.get(id);
      if (!service) {
        service = new IntakeSubmissionService(example.definition, createSyntheticIntakeAdapter());
        services.set(id, service);
      }
      outcome = await service.submit(submission.submissionId, submission.values);
    }
    const statuses: Record<IntakeOutcome['status'], number> = { accepted: 201, invalid: 422, pending: 409,
      uncertain: 409, rejected: 422, capacity: 503, conflict: 409 };
    return reply(outcome, statuses[outcome.status]);
  } catch {
    return reply({ error: 'Invalid JSON submission.' }, 400);
  }
}
