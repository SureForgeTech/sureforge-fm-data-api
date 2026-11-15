import type { IncomingMessage } from 'node:http';

export function previewGateStatus(
  request: Pick<IncomingMessage, 'headers' | 'method' | 'url'>,
  session: string | undefined,
  upgrade?: boolean
): 200 | 401 | 403;
