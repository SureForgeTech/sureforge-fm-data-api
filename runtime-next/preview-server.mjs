// The private preview started from VS Code runs this instead of `next dev`.
//
// `next dev` answers its own development endpoints (hot reload WebSocket, /_next/*, /__nextjs_*)
// before proxy.ts runs, so the session cookie did not protect them. Here every request and every
// WebSocket upgrade passes the Host and session-cookie gate first; only then does Next see it.
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import next from 'next';
import { previewGateStatus } from './lib/preview-gate.mjs';

const hostname = '127.0.0.1';
const port = 3000;
const session = process.env.FMWEB_PREVIEW_SESSION;
const refusals = {
  401: 'Open this preview using the private launch link from VS Code.',
  403: 'Preview Host is not allowed.'
};

// Next adds its own, ungated upgrade listener (hot reload) to the `httpServer` it is given, or
// else to the server of the first request. Hand it a private emitter instead: only upgrades
// that passed the gate are forwarded to it.
const gatedUpgrades = new EventEmitter();
const app = next({ dev: true, hostname, port, httpServer: gatedUpgrades });
await app.prepare();
const handle = app.getRequestHandler();

const server = createServer((request, response) => {
  const status = previewGateStatus(request, session);
  if (status !== 200) {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    response.end(refusals[status]);
    return;
  }
  void handle(request, response);
});
server.on('upgrade', (request, socket, head) => {
  if (previewGateStatus(request, session, true) !== 200) {
    socket.destroy();
    return;
  }
  // Next starts listening with the first page request; before that nobody would answer.
  if (!gatedUpgrades.emit('upgrade', request, socket, head)) socket.destroy();
});
// The extension waits for this line before it opens the browser.
server.listen(port, hostname, () => console.log('✓ Ready'));
