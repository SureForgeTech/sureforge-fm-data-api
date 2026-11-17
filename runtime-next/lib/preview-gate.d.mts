import type { IncomingMessage } from 'node:http';

export function previewGateStatus(
  request: Pick<IncomingMessage, 'headers' | 'method' | 'url'>,
  session: string | undefined,
  upgrade?: boolean
): 200 | 401 | 403;

export function createPreviewLandingRedirect(
  session: string | undefined,
  intakeId: string | undefined
): (request: Pick<IncomingMessage, 'headers' | 'method' | 'url'>) => string | undefined;
