import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import type { ConnectionProfile } from '../../types/fm';
import { FMClientError } from '../errors';

// The sign-in pause only needs to detect credential changes within this process.
const credentialStampSalt = randomBytes(32);
const deriveCredentialStamp = promisify(scrypt);

export async function credentialStamp(profile: ConnectionProfile, username: string, password: string): Promise<string> {
  const credentials = JSON.stringify([profile.serverUrl, profile.database, username, password]);
  const stamp = await deriveCredentialStamp(credentials, credentialStampSalt, 32);
  return (stamp as Buffer).toString('hex');
}

/**
 * A shared sign-in belongs to the connection; each waiting request owns only its own wait.
 *
 * The wait is bounded by the waiting request's own deadline. A request that asked for a short
 * deadline must not wait for a sign-in that runs under a longer one: it would end at a deadline the
 * user never chose, and with advice that names the wrong setting.
 */
export function waitForSession<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  timeoutMs?: number,
  advice = 'If the server is slow, raise the setting filemaker.requestTimeoutMs.'
): Promise<T> {
  if (!signal && timeoutMs === undefined) return promise;
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(new FMClientError('Request cancelled.', { kind: 'cancellation', isRetryable: false }));
    };
    const expire = () => {
      cleanup();
      reject(new FMClientError(
        `The session did not arrive: the request timed out after ${((timeoutMs ?? 0) / 1000).toFixed(1)} s. ${advice}`,
        { kind: 'timeout', isRetryable: true }
      ));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timer = setTimeout(expire, timeoutMs);
      timer.unref?.();
    }
    // Attach handlers even when already aborted: a later failed shared login must be observed.
    promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}
