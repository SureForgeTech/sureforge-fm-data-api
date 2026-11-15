import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { previewGateStatus } from './preview-gate.mjs';

const session = 's'.repeat(64);
const request = (url: string, cookie?: string, host = '127.0.0.1:3000', method = 'GET') =>
  ({ url, method, headers: { host, ...(cookie ? { cookie } : {}) } });
const devEndpoints = ['/_next/hmr', '/_next/webpack-hmr', '/_next/static/chunks/main.js', '/__nextjs_original-stack-frames', '/__nextjs_source-map?launch=x', '/_next/webpack-hmr?launch=x'];

describe('private preview gate in front of Next', () => {
  it.each(devEndpoints)('refuses %s without the session cookie, as a request and as a WebSocket upgrade', (url) => {
    expect(previewGateStatus(request(url), session)).toBe(401);
    expect(previewGateStatus(request(url), session, true)).toBe(401);
    expect(previewGateStatus(request(url, 'fmweb_preview=wrong'), session, true)).toBe(401);
    expect(previewGateStatus(request(url, `other=${session}`), session, true)).toBe(401);
  });

  it.each(devEndpoints)('lets %s through with the session cookie', (url) => {
    expect(previewGateStatus(request(url, `theme=dark; fmweb_preview=${session}`), session)).toBe(200);
    expect(previewGateStatus(request(url, `fmweb_preview=${session}`), session, true)).toBe(200);
  });

  it('refuses another Host even with the cookie', () => {
    expect(previewGateStatus(request('/', `fmweb_preview=${session}`, 'evil.example:3000'), session)).toBe(403);
    expect(previewGateStatus(request('/_next/webpack-hmr', `fmweb_preview=${session}`, 'evil.example'), session, true)).toBe(403);
  });

  it('lets only the first page load with a launch code through without the cookie', () => {
    expect(previewGateStatus(request('/?launch=abc'), session)).toBe(200);
    expect(previewGateStatus(request('/'), session)).toBe(401);
    expect(previewGateStatus(request('/?other=1'), session)).toBe(401);
    expect(previewGateStatus(request('/?launch=abc', undefined, '127.0.0.1:3000', 'POST'), session)).toBe(401);
    expect(previewGateStatus(request('/?launch=abc'), session, true)).toBe(401);
    expect(previewGateStatus(request('//_next/webpack-hmr?launch=abc'), session)).toBe(401);
    expect(previewGateStatus(request('http://127.0.0.1:3000/_next/x?launch=abc'), session)).toBe(401);
  });

  it('refuses everything when no session was configured', () => {
    expect(previewGateStatus(request('/', 'fmweb_preview='), undefined)).toBe(401);
    expect(previewGateStatus(request('/', 'fmweb_preview=undefined'), undefined)).toBe(401);
  });

  it('is wired in front of both requests and upgrades, and Next gets no server to listen on itself', async () => {
    const server = await readFile(path.resolve(__dirname, '../preview-server.mjs'), 'utf8');
    expect(server).toContain('httpServer: gatedUpgrades');
    expect(server).not.toContain('getUpgradeHandler');
    expect(server.match(/previewGateStatus\(request, session(?:, true)?\)/g)).toHaveLength(2);
    expect(server.indexOf('previewGateStatus(request, session)')).toBeLessThan(server.indexOf('handle(request, response)'));
    expect(server.indexOf('previewGateStatus(request, session, true)')).toBeLessThan(server.indexOf("gatedUpgrades.emit('upgrade', request, socket, head)"));
  });
});
