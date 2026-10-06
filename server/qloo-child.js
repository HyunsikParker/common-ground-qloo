import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError, publicError } from './errors.js';
import { loadAccess, reserveRequest } from './qloo-access.js';
import { qlooCommand } from './qloo-command.js';

const write = process.stdout.write.bind(process.stdout);
const upstreamFetch = globalThis.fetch;
let captured = '', home, requests = 0, guardError;
// The official CLI runs in this isolated child. Never relay its raw diagnostics.
process.stdout.write = value => {
  captured += String(value);
  if (Buffer.byteLength(captured) > 1_100_000) throw new AppError('provider_response_too_large', 'The Qloo response exceeded this app’s size limit.', 502);
  return true;
};
process.stderr.write = () => true;

async function readInput() {
  let result = '';
  for await (const chunk of process.stdin) {
    result += chunk.toString();
    if (Buffer.byteLength(result) > 8192) throw new AppError('invalid_provider_input', 'The Qloo request is too large.');
  }
  try { return JSON.parse(result); } catch { throw new AppError('invalid_provider_input', 'The Qloo request is invalid.'); }
}

async function run() {
  const { operation, input, accessFile } = await readInput();
  const command = qlooCommand(operation, input);
  const access = loadAccess(accessFile);
  home = mkdtempSync(join(tmpdir(), 'common-ground-qloo-'));
  process.env.QLOO_HOME = home;
  process.env.QLOO_API_KEY = access.key;
  // The issuer's event guide and access email bind this credential to this
  // exact host. Never try staging or production if event authentication fails.
  const origin = 'https://hackathon.api.qloo.com';
  process.env.QLOO_BASE_URL = origin;
  process.env.QLOO_TRUSTED_BASE_URL = origin;
  globalThis.fetch = async (resource, init = {}) => {
    try {
      const url = new URL(typeof resource === 'string' || resource instanceof URL ? resource : resource.url);
      if (url.origin !== origin || url.pathname !== command.endpoint || url.username || url.password || url.hash || init.method !== 'GET' || init.body || ++requests > 1) {
        throw new AppError('unexpected_provider_request', 'The Qloo tool attempted an unsupported request. No fallback is allowed.', 502);
      }
      await reserveRequest(access);
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await upstreamFetch(url, { ...init, redirect: 'error', signal: controller.signal });
        if ([401, 403].includes(response.status)) { await response.body?.cancel(); throw new AppError('authentication_failed', 'Qloo access could not be authenticated.', 503); }
        if (response.status === 429) { await response.body?.cancel(); throw new AppError('provider_rate_limited', 'Qloo’s request limit was reached. No automatic retry was made.', 429); }
        if (!response.ok) { await response.body?.cancel(); throw new AppError('provider_unavailable', 'Qloo is unavailable. No automatic retry was made.', 502); }
        const reader = response.body?.getReader(); if (!reader) throw new AppError('invalid_provider_result', 'Qloo returned an empty response body.', 502);
        const chunks = []; let size = 0;
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 1_000_000) { await reader.cancel(); throw new AppError('provider_response_too_large', 'The Qloo response exceeded this app’s size limit.', 502); }
          chunks.push(Buffer.from(value));
        }
        const body = Buffer.concat(chunks).toString('utf8'); let data;
        if (body.includes(access.key)) throw new AppError('invalid_provider_result', 'Qloo returned an unsafe response.', 502);
        try { data = JSON.parse(body); } catch { throw new AppError('invalid_provider_result', 'Qloo returned invalid JSON.', 502); }
        const rows = command.endpoint === '/search' ? data?.results : data?.results?.entities;
        if (!Array.isArray(rows) || rows.length > command.take || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)) || data.error || data.errors) throw new AppError('invalid_provider_result', 'Qloo returned an unsupported result shape.', 502);
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (controller.signal.aborted) throw new AppError('provider_timeout', 'Qloo did not finish within the request deadline.', 504);
        throw new AppError('provider_unavailable', 'The Qloo request failed. No alternate endpoint or credential was used.', 502);
      } finally { clearTimeout(timer); }
    } catch (error) { guardError = error; throw error; }
  };
  const { runQloo } = await import('@qloo/qloo-harness');
  const code = await runQloo(command.argv);
  if (guardError) throw guardError;
  if (code !== 0 || requests !== 1) throw new AppError('provider_unavailable', 'The supported Qloo command could not complete.', 502);
  let rows;
  try { rows = JSON.parse(captured); } catch { throw new AppError('invalid_provider_result', 'The Qloo tool returned invalid output.', 502); }
  if (!Array.isArray(rows)) throw new AppError('invalid_provider_result', 'The Qloo tool returned an unsupported output shape.', 502);
  // Return only the fields the app uses, never CLI diagnostics or request headers.
  return { ok: true, rows: rows.map(row => ({ entity_id: row.entity_id, name: row.name,
    type: (typeof row.type === 'string' && /^urn:entity:/.test(row.type) ? row.type : undefined)
      ?? (Array.isArray(row.types) ? row.types.find(type => /^urn:entity:/.test(type)) : undefined)
      ?? (row.type === 'urn:entity' && command.endpoint === '/v2/insights' ? 'urn:entity:place' : row.type),
    affinity: row.affinity ?? row.query?.affinity, properties: { release_year: row.properties?.release_year, description: row.properties?.description, short_description: row.properties?.short_description } })) };
}

let result;
try { result = await run(); }
catch (error) { const safe = publicError(error); result = { ok: false, error: safe.error, status: safe.status }; }
finally { if (home) rmSync(home, { recursive: true, force: true }); }
await new Promise(resolve => write(JSON.stringify(result) + '\n', resolve));
process.exit(0);
