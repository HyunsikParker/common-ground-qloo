import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GroupService } from './service.js';
import { AppError, publicError } from './errors.js';
import { configuredProvider } from './provider.js';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const lifetime = 20 * 60_000;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
function json(response, code, payload) {
  response.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}
async function body(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new AppError('content_type', 'Send a JSON request.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 12_000) throw new AppError('request_too_large', 'This request is too large.', 413);
    chunks.push(chunk);
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error();
    return result;
  } catch { throw new AppError('invalid_json', 'Send a valid JSON object.'); }
}

export function createAppServer({ provider = configuredProvider(), appOrigin = process.env.APP_ORIGIN } = {}) {
  const sessions = new Map();
  return createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
    try {
      const pathname = new URL(request.url, 'http://local.invalid').pathname;
      if (!pathname.startsWith('/api/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD') throw new AppError('method_not_allowed', 'Use GET for this resource.', 405);
        const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\//, '');
        const filename = resolve(dist, relative);
        if (!(relative === 'index.html' || relative.startsWith('assets/')) || !filename.startsWith(resolve(dist) + sep)) throw new AppError('not_found', 'This page is not available.', 404);
        let bytes;
        try { bytes = await readFile(filename); } catch { throw new AppError('not_found', 'Build the frontend before starting the server.', 404); }
        const extension = filename.slice(filename.lastIndexOf('.'));
        response.writeHead(200, { 'content-type': `${types[extension] ?? 'application/octet-stream'}; charset=utf-8`, 'cache-control': relative === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
        response.end(request.method === 'HEAD' ? undefined : bytes); return;
      }
      const allowedOrigin = appOrigin ?? `http://${request.headers.host}`;
      if (request.headers.origin && request.headers.origin !== allowedOrigin) throw new AppError('origin_rejected', 'Open the app directly to change a group.', 403);
      const now = Date.now();
      for (const [key, session] of sessions) if (session.expires <= now) sessions.delete(key);
      const token = request.headers.cookie?.match(/(?:^|;\s*)cg_session=([0-9a-f-]{36})(?:;|$)/)?.[1];
      let session = sessions.get(token);
      if (!session) {
        if (sessions.size >= 100) throw new AppError('server_busy', 'The app is busy. Try again shortly.', 503);
        const id = randomUUID();
        session = { service: new GroupService(provider), expires: now + lifetime, window: now, count: 0 };
        sessions.set(id, session);
        response.setHeader('set-cookie', `cg_session=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=1200${allowedOrigin.startsWith('https:') ? '; Secure' : ''}`);
      }
      session.expires = now + lifetime;
      if (now - session.window >= 60_000) { session.window = now; session.count = 0; }
      if (++session.count > 60) throw new AppError('rate_limited', 'Pause for a moment before making another request.', 429);
      const service = session.service;
      if (request.method === 'GET' && pathname === '/api/session') { json(response, 200, service.state()); return; }
      if (request.method !== 'POST') throw new AppError('method_not_allowed', 'Use a supported request method.', 405);
      const input = await body(request);
      const result = await service.enqueue(async () => {
        if (input.revision !== service.revision) throw new AppError('stale_session', 'This group changed in another request. Reload the current comparison before continuing.', 409);
        switch (pathname) {
          case '/api/resolve': return service.resolve(input.query);
          case '/api/confirm': return service.confirm(input.resolutionId, input.entityId);
          case '/api/compare': return service.compare(input.groups, input.area);
          case '/api/exclude': return service.veto(input.id);
          case '/api/restore': return service.veto(input.id, true);
          case '/api/sample': return service.sample();
          case '/api/example': return service.publicExample();
          case '/api/reset': return service.reset();
          default: throw new AppError('not_found', 'This action is not available.', 404);
        }
      });
      json(response, 200, result);
    } catch (error) {
      const safe = publicError(error); json(response, safe.status, { error: safe.error });
    }
  });
}
