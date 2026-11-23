import { effectiveTimeout, hasOwnDeadline, withRequestLimits } from '../requestLimits';
import { noteRequestTimeout } from '../tlsAgent';
import { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ConnectionProfile } from '../../types/fm';
import type { DataApiEnvelope } from '../../types/dataApi';
import { FMClientError, toFMClientError } from '../errors';
import { normalizeError } from '../../utils/normalizeError';
import { redactString } from '../../utils/redact';
import { httpsTransportFor } from '../tlsAgent';
import { parseDataApiEnvelope } from '../responseGuard';
import type { RequestOptions, RequestTrace } from './types';
import type { ClientContext } from './context';
import { normalizeHeaders } from './response';

/** Each step spends the same per-request budget; unusable overrides keep the shared behaviour. */
export function requestTimeoutBudget(timeoutMs: number | undefined): () => number | undefined {
  const deadline = hasOwnDeadline(timeoutMs) ? Date.now() + timeoutMs : undefined;
  return () => {
    if (deadline === undefined) return timeoutMs;
    const remaining = deadline - Date.now();
    if (remaining > 0) return remaining;
    throw toFMClientError(normalizeError(new AxiosError('FileMaker request timed out.', 'ECONNABORTED'), {
      timeoutOverride: true
    }));
  };
}

function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new FMClientError('Request cancelled.', { kind: 'cancellation', isRetryable: false });
  }
}

export async function requestWithAuth<TResponse extends Record<string, unknown>>(
  client: ClientContext,
  profile: ConnectionProfile,
  request: RequestOptions,
  retryOn401 = true,
  trace?: RequestTrace,
  authOptions?: { skipProactiveRefresh?: boolean },
  remainingTimeout = requestTimeoutBudget(request.timeoutMs)
): Promise<DataApiEnvelope<TResponse>> {
  if (trace) {
    trace.endpoint = redactString(`${request.method} ${request.path}`);
  }

  // The session work a request needs shares its deadline: a sign-in that the server takes longer
  // than the shared timeout to answer must not end a run that asked for longer.
  checkCancellation(request.signal);
  const token = await client.ensureSessionToken(profile, { signal: request.signal, timeoutMs: remainingTimeout() }, authOptions);
  // The deadline in force: the request's own when it asked for a usable one, the shared timeout
  // otherwise. The advice names it when it is not the shared one.
  const ownDeadline = hasOwnDeadline(request.timeoutMs);

  try {
    checkCancellation(request.signal);
    const timeoutMs = effectiveTimeout(remainingTimeout(), client.timeoutMs);
    const config: AxiosRequestConfig = {
      method: request.method,
      url: buildEndpoint(profile, request.path),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(request.headers ?? {})
      },
      data: request.data,
      params: request.params,
      ...(request.strictQuery ? { paramsSerializer: { serialize: strictQuerySerializer } } : {}),
      // The Data API never redirects. Following one could send a login to another server or drop
      // the request body; a redirect is reported as an error that says where it pointed.
      maxRedirects: 0,
      ...httpsTransportFor(profile, buildEndpoint(profile, request.path))
    };

    // A run that may last longer than the shared timeout needs its retired agent to outlive it. The whole
    // deadline, not what is left of it, so the agent never retires before the run's last step.
    noteRequestTimeout(effectiveTimeout(request.timeoutMs, client.timeoutMs));
    const response = await withRequestLimits(timeoutMs, request.signal,
      (limits) => client.httpClient.request<unknown>({ ...config, ...limits }), request.maxResponseBytes,
      ownDeadline && request.transfer === true ? false : request.transfer, config.transport, request.uploadBytes);
    return parseDataApiEnvelope<TResponse>(response);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401 && retryOn401) {
      if (trace) {
        trace.reauthCount += 1;
      }
      client.logger.info('Session token rejected; refreshing token and retrying once.', {
        profileId: profile.id,
        requestId: trace?.requestId
      });
      checkCancellation(request.signal);
      await client.renewRejectedSession(profile, token, { signal: request.signal, timeoutMs: remainingTimeout() });

      return requestWithAuth(client, profile, request, false, trace, undefined, remainingTimeout);
    }

    throw client.explainPinnedFailure(
      profile,
      toFMClientError(
        normalizeError(error, {
          operation: trace?.operation,
          requestData: request.data,
          requestParams: request.params,
          fallbackMessage: `FileMaker request failed (${redactString(`${request.method} ${request.path}`)}).`,
          requestId: trace?.requestId,
          endpoint: redactString(`${request.method} ${request.path}`),
          timeoutOverride: ownDeadline
        })
      )
    );
  }
}

export async function requestWithAuthRaw<TResponse extends Record<string, unknown>>(
  client: ClientContext,
  profile: ConnectionProfile,
  request: RequestOptions,
  retryOn401 = true,
  trace?: RequestTrace,
  remainingTimeout = requestTimeoutBudget(request.timeoutMs)
): Promise<{
  status: number;
  headers: Record<string, string | undefined>;
  envelope?: DataApiEnvelope<TResponse>;
}> {
  if (trace) {
    trace.endpoint = redactString(`${request.method} ${request.path}`);
  }

  checkCancellation(request.signal);
  const token = await client.ensureSessionToken(profile, { signal: request.signal, timeoutMs: remainingTimeout() });
  const ownDeadline = hasOwnDeadline(request.timeoutMs);

  try {
    checkCancellation(request.signal);
    const timeoutMs = effectiveTimeout(remainingTimeout(), client.timeoutMs);
    const config: AxiosRequestConfig = {
      method: request.method,
      url: buildEndpoint(profile, request.path),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(request.headers ?? {})
      },
      data: request.data,
      params: request.params,
      ...(request.strictQuery ? { paramsSerializer: { serialize: strictQuerySerializer } } : {}),
      maxRedirects: 0,
      ...httpsTransportFor(profile, buildEndpoint(profile, request.path)),
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304
    };

    noteRequestTimeout(effectiveTimeout(request.timeoutMs, client.timeoutMs));
    const response = await withRequestLimits(timeoutMs, request.signal,
      (limits) => client.httpClient.request<unknown>({ ...config, ...limits }), request.maxResponseBytes,
      ownDeadline && request.transfer === true ? false : request.transfer, config.transport, request.uploadBytes);
    const headers = normalizeHeaders(response.headers as Record<string, unknown>);
    if (response.status === 304) {
      return {
        status: response.status,
        headers
      };
    }

    return {
      status: response.status,
      headers,
      envelope: parseDataApiEnvelope<TResponse>(response)
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401 && retryOn401) {
      if (trace) {
        trace.reauthCount += 1;
      }
      client.logger.info('Session token rejected; refreshing token and retrying once.', {
        profileId: profile.id,
        requestId: trace?.requestId
      });
      checkCancellation(request.signal);
      await client.renewRejectedSession(profile, token, { signal: request.signal, timeoutMs: remainingTimeout() });

      return requestWithAuthRaw(client, profile, request, false, trace, remainingTimeout);
    }

    throw client.explainPinnedFailure(
      profile,
      toFMClientError(
        normalizeError(error, {
          operation: trace?.operation,
          requestData: request.data,
          requestParams: request.params,
          fallbackMessage: `FileMaker request failed (${redactString(`${request.method} ${request.path}`)}).`,
          requestId: trace?.requestId,
          endpoint: redactString(`${request.method} ${request.path}`),
          timeoutOverride: ownDeadline
        })
      )
    );
  }
}

export async function requestNoAuth<TResponse extends Record<string, unknown>>(
  client: ClientContext,
  profile: ConnectionProfile,
  request: RequestOptions
): Promise<DataApiEnvelope<TResponse>> {
  const config: AxiosRequestConfig = {
    method: request.method,
    url: buildEndpoint(profile, request.path),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(request.headers ?? {})
    },
    data: request.data,
    params: request.params,
    maxRedirects: 0,
    ...httpsTransportFor(profile, buildEndpoint(profile, request.path))
  };

  const timeoutMs = effectiveTimeout(request.timeoutMs, client.timeoutMs);
  noteRequestTimeout(timeoutMs);
  const response = await withRequestLimits(timeoutMs, request.signal,
    (limits) => client.httpClient.request<unknown>({ ...config, ...limits }), request.maxResponseBytes);
  return parseDataApiEnvelope<TResponse>(response);
}

export function buildEndpoint(profile: ConnectionProfile, path: string): string {
  const server = new URL(profile.serverUrl);
  server.username = '';
  server.password = '';
  const normalizedServer = server.toString().replace(/\/+$/, '');
  const normalizedBasePath = normalizePath(profile.apiBasePath ?? '/fmi/data');
  const version = (profile.apiVersionPath ?? 'vLatest').replace(/^\/+|\/+$/g, '');
  const database = encodeURIComponent(profile.database);

  return `${normalizedServer}${normalizedBasePath}/${version}/databases/${database}${path}`;
}

export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) {
    return `/${trimmed.replace(/\/+$/, '')}`;
  }

  return trimmed.replace(/\/+$/, '');
}

/** `a=b&c=d` with every key and value percent-encoded (a space is `%20`, a `+` is `%2B`, a `|` is `%7C`). */
export function strictQuerySerializer(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}
