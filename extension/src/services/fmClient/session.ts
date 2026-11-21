import { createHash } from 'crypto';
import type { ConnectionProfile } from '../../types/fm';
import { FMClientError } from '../errors';

export function credentialStamp(profile: ConnectionProfile, username: string, password: string): string {
  return createHash('sha256')
    .update([profile.serverUrl, profile.database, username, password].join('\u0000'))
    .digest('hex');
}

/** A shared sign-in belongs to the connection; each waiting request owns only its own wait. */
export function waitForSession<T>(promise: Promise<T>, signal?: AbortSignal, timeoutMs?: number): Promise<T> {
  if (!signal && !timeoutMs) return promise;
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      if (timer) clearTimeout(timer);
    };
    const abort = () => {
      cleanup();
      reject(new FMClientError('Request cancelled.', { kind: 'cancellation', isRetryable: false }));
    };
    // The sign-in is shared, so waiting for it must not outlive this request's own deadline: one
    // request with a long deadline must not hold the others for that long.
    const expire = () => {
      cleanup();
      reject(new FMClientError(
        `Request timed out waiting for the connection to sign in${timeoutMs ? ` after ${(timeoutMs / 1000).toFixed(1)} s` : ''}. The sign-in may still be running; try again.`,
        {
          kind: 'timeout',
          code: 'SESSION_WAIT_TIMEOUT',
          isRetryable: true
        }
      ));
    };
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timer = setTimeout(expire, timeoutMs);
      timer.unref?.();
    }
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }
    // Attach handlers even when already aborted: a later failed shared login must be observed.
    promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}
