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

/** A shared sign-in belongs to the connection; each waiting request owns only its own wait. */
export function waitForSession<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      cleanup();
      reject(new FMClientError('Request cancelled.', { kind: 'cancellation', isRetryable: false }));
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    // Attach handlers even when already aborted: a later failed shared login must be observed.
    promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}
