import { readFileSync, appendFileSync } from 'node:fs';
import { Socket } from 'node:net';

// Test-only preload. It is never selected by the production transport.
// Replace fetch before the real Qloo CLI is imported, and deny socket fallback.
const scenario = JSON.parse(readFileSync(process.env.COMMON_GROUND_TEST_SCENARIO, 'utf8'));
Socket.prototype.connect = function () { throw new Error('Network forbidden in Qloo transport tests'); };
globalThis.fetch = async (resource, init) => {
  const url = new URL(resource);
  appendFileSync(scenario.logFile, JSON.stringify({
    origin: url.origin, endpoint: url.pathname, method: init.method,
    params: Object.fromEntries(url.searchParams), redirect: init.redirect,
    hasDeadline: init.signal instanceof AbortSignal,
    credentialMatches: new Headers(init.headers).get('x-api-key') === scenario.syntheticKey,
    ambientMissing: ['NODE_OPTIONS', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'HTTPS_PROXY'].every(name => process.env[name] === undefined),
    eventTrustMatches: process.env.QLOO_TRUSTED_BASE_URL === 'https://hackathon.api.qloo.com',
    isolatedHome: process.env.QLOO_HOME,
  }) + '\n', { mode: 0o600 });
  if (scenario.failure === 'throw') throw new Error(`Raw upstream diagnostic: ${scenario.syntheticKey}`);
  if (scenario.failure === 'timeout') {
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  }
  if (scenario.failure === 'redirect') throw new TypeError('Redirect rejected');
  process.stderr.write(`Raw CLI diagnostic: ${scenario.syntheticKey}\n`);
  const body = scenario.rawBody ?? JSON.stringify(scenario.body);
  return new Response(body, { status: scenario.status ?? 200, headers: { 'content-type': 'application/json' } });
};
