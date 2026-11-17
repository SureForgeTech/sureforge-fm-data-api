// Plain JavaScript on purpose: preview-server.mjs runs under Node before Next compiles anything.
import { createHash, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'fmweb_preview';
const HOSTS = ['127.0.0.1:3000', 'localhost:3000'];
const digest = (value) => createHash('sha256').update(value).digest();

function sessionCookie(header) {
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index !== -1 && part.slice(0, index).trim() === SESSION_COOKIE) return part.slice(index + 1).trim();
  }
  return undefined;
}

/**
 * The private preview's gate for EVERY request and WebSocket upgrade, before Next sees it:
 * 200 lets it through, 403 is a wrong Host, 401 is a missing or wrong session cookie.
 *
 * The only thing let through without the cookie is the first page load carrying a launch
 * code (`GET /?launch=...`); proxy.ts then checks the code and sets the cookie. The match is
 * on the raw request target, so no other path (such as /_next or /__nextjs) can qualify.
 */
export function previewGateStatus(request, session, upgrade = false) {
  if (!HOSTS.includes(request.headers.host ?? '')) return 403;
  const cookie = sessionCookie(request.headers.cookie);
  if (cookie && session && timingSafeEqual(digest(cookie), digest(session))) return 200;
  const target = request.url ?? '';
  if (!upgrade && request.method === 'GET' && target.startsWith('/?') &&
      new URLSearchParams(target.slice(2)).has('launch')) return 200;
  return 401;
}

/** Land on an explicitly selected form once, after launch redemption has set the session cookie. */
export function createPreviewLandingRedirect(session, intakeId) {
  const destination = typeof intakeId === 'string' && /^[a-z]/.test(intakeId) && !/[^a-z0-9_-]/.test(intakeId) && intakeId.length <= 64
    ? `/intake/${intakeId}` : undefined;
  let pending = Boolean(destination);
  return (request) => {
    if (!pending || request.method !== 'GET' || request.url !== '/' || previewGateStatus(request, session) !== 200) return undefined;
    pending = false;
    return destination;
  };
}
