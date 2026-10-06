import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, realpathSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAccess, initialBudget, reserveRequest } from '../server/qloo-access.js';
import { HarnessTransport } from '../server/qloo-transport.js';
import { qlooCommand } from '../server/qloo-command.js';
import { QlooProvider } from '../server/qloo-provider.js';
import { configuredProvider } from '../server/provider.js';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, type = 'place') => ({ entity_id: id(n), type: `urn:entity:${type}`, name: `Synthetic ${type} ${n}`, query: { affinity: n / 100 }, properties: { description: 'Invented test record', private_field: 'Not for clients' }, private_field: 'Not for clients' });
const search = { query: 'Arrival', types: 'urn:entity:movie', take: 4 };
const recommend = { target_type: 'place', signals: [id(1)], filter_location: 'Manhattan, New York', explain: true, limit: 4 };
const rank = { option_type: 'place', signals: [id(1)], options: [id(11), id(12)] };
const preload = fileURLToPath(new URL('./support/offline-qloo-fetch.mjs', import.meta.url));

function fixture(t, overrides = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'common-ground-test-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const accessFile = join(dir, 'access.json'), credentialFile = join(dir, 'credential'), budgetFile = join(dir, 'budget.json');
  const syntheticKey = 'SYNTHETIC_OFFLINE_KEY_NOT_A_CREDENTIAL';
  const config = { version: 1, accessId: 'synthetic-offline-test', freeUseVerified: true, evidenceUrl: 'https://example.invalid/synthetic-only', verifiedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), maxRequests: 20, minIntervalMs: 0, credentialFile, budgetFile, ...overrides };
  const save = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
  save(credentialFile, syntheticKey); save(budgetFile, {}); save(accessFile, config);
  const access = loadAccess(accessFile); save(budgetFile, initialBudget(access));
  const logFile = join(dir, 'calls.jsonl'); save(logFile, '');
  const calls = () => readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const budget = () => JSON.parse(readFileSync(budgetFile, 'utf8'));
  let count = 0, children = 0;
  function transport(scenario = {}) {
    const scenarioFile = join(dir, `scenario-${++count}.json`); save(scenarioFile, { body: { results: [] }, ...scenario, logFile, syntheticKey });
    return new HarnessTransport({ accessFile, spawnChild(executable, args, options) {
      children++;
      assert.equal(executable, process.execPath);
      assert.deepEqual(args, [fileURLToPath(new URL('../server/qloo-child.js', import.meta.url))]);
      assert.deepEqual(Object.keys(options.env).sort(), ['LANG', 'NO_COLOR', 'PATH']);
      assert.ok(!args.join(' ').includes(syntheticKey));
      return spawn(executable, ['--import', preload, ...args], { ...options, env: { ...options.env, COMMON_GROUND_TEST_SCENARIO: scenarioFile } });
    } });
  }
  return { dir, accessFile, config, save, access, calls, budget, transport, children: () => children, syntheticKey };
}

test('the real official qloo api CLI completes search, recommendation and supplied-option rank offline', async t => {
  const f = fixture(t);
  const searchRows = await f.transport({ body: { results: [row(1, 'movie')] } }).invoke('search', search);
  assert.equal(searchRows[0].entity_id, id(1));
  assert.equal(searchRows[0].private_field, undefined);
  assert.equal(searchRows[0].properties.private_field, undefined);
  const recommended = await f.transport({ body: { results: { entities: [row(11), row(12)] } } }).executor.execute('recommend', recommend);
  assert.equal(recommended.result.status, 'ok');
  const rankTransport = f.transport({ body: { results: { entities: [row(11), row(12)] } } });
  const provider = new QlooProvider({ client: rankTransport.client, executor: rankTransport.executor, area: recommend.filter_location });
  assert.deepEqual(await provider.rank(rank.signals, rank.options), { [id(11)]: 0.11, [id(12)]: 0.12 });
  const calls = f.calls(); assert.equal(calls.length, 3); assert.equal(f.budget().used, 3);
  for (const call of calls) {
    assert.equal(call.origin, 'https://hackathon.api.qloo.com'); assert.equal(call.method, 'GET'); assert.equal(call.redirect, 'error');
    assert.ok(call.eventTrustMatches);
    assert.ok(call.hasDeadline && call.credentialMatches && call.ambientMissing);
    assert.equal(existsSync(call.isolatedHome), false);
  }
  assert.deepEqual(calls[0].params, { query: 'Arrival', types: 'urn:entity:movie', take: '4' });
  assert.equal(calls[1].params['filter.type'], 'urn:entity:place');
  assert.equal(calls[1].params['signal.interests.entities'], id(1));
  assert.equal(calls[1].params['filter.location.query'], 'Manhattan, New York');
  assert.equal(calls[2].params['filter.results.entities'], rank.options.join(','));
  assert.equal(calls[2].params.take, '2');
});

test('one allowance persists across new transport instances and blocks before a second upstream attempt', async t => {
  const f = fixture(t, { maxRequests: 1 });
  await f.transport().invoke('search', search);
  await assert.rejects(f.transport().invoke('search', search), { code: 'quota_exhausted' });
  assert.equal(f.calls().length, 1); assert.equal(f.budget().used, 1);
});

test('the app factory requires explicit private allowance and can construct the issued-event provider without requests', t => {
  const f = fixture(t);
  const provider = configuredProvider({ COMMON_GROUND_PROVIDER: 'qloo', COMMON_GROUND_ACCESS_FILE: f.accessFile, COMMON_GROUND_DEFAULT_AREA: 'Brooklyn, New York' });
  assert.equal(provider.mode, 'qloo');
  assert.equal(provider.area, 'Brooklyn, New York');
  assert.equal(f.budget().used, 0);
  assert.throws(() => configuredProvider({ COMMON_GROUND_PROVIDER: 'qloo', COMMON_GROUND_ACCESS_FILE: f.accessFile, COMMON_GROUND_DEFAULT_AREA: 'person@example.invalid' }), { code: 'invalid_area' });
  f.save(f.accessFile, { ...f.config, freeUseVerified: false });
  assert.throws(() => configuredProvider({ COMMON_GROUND_PROVIDER: 'qloo', COMMON_GROUND_ACCESS_FILE: f.accessFile }), { code: 'access_pending' });
  assert.equal(f.budget().used, 0);
});

test('operator-chosen limits for an issued key remain distinct from published quotas and reject a fee notice', t => {
  const f = fixture(t, { version: 2, eventAccessVerified: true, feeNoticeReceived: false, limitBasis: 'operator', freeUseVerified: undefined, issuerQuota: null, issuerRateLimit: null, issuerExpiry: null });
  assert.equal(configuredProvider({ COMMON_GROUND_PROVIDER: 'qloo', COMMON_GROUND_ACCESS_FILE: f.accessFile }).mode, 'qloo');
  assert.equal(f.access.config.limitBasis, 'operator');
  assert.equal(f.access.config.issuerQuota, null);
  assert.equal(f.budget().used, 0);
  f.save(f.accessFile, { ...f.config, feeNoticeReceived: true });
  assert.throws(() => loadAccess(f.accessFile), { code: 'access_pending' });
  f.save(f.accessFile, { ...f.config, limitBasis: 'unverified_issuer_claim' });
  assert.throws(() => loadAccess(f.accessFile), { code: 'access_pending' });
});

test('the actual API types-array shape is preserved as an entity type without inventing a missing category', async t => {
  const f = fixture(t); const actualShape = { ...row(1, 'movie'), type: undefined, types: ['urn:entity:movie'] };
  const rows = await f.transport({ body: { results: [actualShape] } }).invoke('search', search);
  assert.equal(rows[0].type, 'urn:entity:movie');
  const missing = await f.transport({ body: { results: [{ ...actualShape, types: undefined }] } }).invoke('search', search);
  assert.equal(missing[0].type, undefined);
});

test('generic Insights entity metadata uses its documented place filter, while explicit conflicting types remain rejected', async t => {
  const f=fixture(t);const transport=f.transport({body:{results:{entities:[{...row(11),type:'urn:entity'}]}}});
  const provider=new QlooProvider({client:transport.client,executor:transport.executor,area:recommend.filter_location});
  assert.equal((await provider.suggest([id(1)]))[0].kind,'Place');
  const conflicting=f.transport({body:{results:{entities:[row(12,'artist')]}}});
  await assert.rejects(new QlooProvider({client:conflicting.client,executor:conflicting.executor,area:recommend.filter_location}).suggest([id(1)]),{code:'invalid_provider_result'});
});

test('concurrent subprocesses cannot spend the same final allowance twice', async t => {
  const f = fixture(t, { maxRequests: 1 });
  const results = await Promise.allSettled([f.transport().invoke('search', search), f.transport().invoke('search', search)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  const rejected = results.find(item => item.status === 'rejected');
  assert.ok(['quota_exhausted', 'budget_busy'].includes(rejected.reason.code));
  assert.equal(f.calls().length, 1); assert.equal(f.budget().used, 1);
});

test('rate spacing is enforced against the durable clock and expiry, without spending during a refused wait', async t => {
  const f = fixture(t, { minIntervalMs: 1000 }); let current = Date.now();
  await reserveRequest(f.access, { now: () => current });
  await assert.rejects(reserveRequest(f.access, { now: () => current, maxWaitMs: 500 }), { code: 'local_rate_limited' });
  assert.equal(f.budget().used, 1);
  let waited = 0;
  await reserveRequest(f.access, { now: () => current, wait: async ms => { current += ms; waited += ms; } });
  assert.equal(waited, 1000); assert.equal(f.budget().used, 2);
  current = f.access.expires;
  await assert.rejects(reserveRequest(f.access, { now: () => current }), { code: 'access_expired' });
});

test('missing, expired, unsafe or edited access configuration never reaches fetch', async t => {
  for (const change of [
    f => rmSync(f.accessFile),
    f => f.save(f.accessFile, { ...f.config, expiresAt: new Date(Date.now() - 1).toISOString() }),
    f => chmodSync(f.config.credentialFile, 0o644),
    f => f.save(f.config.budgetFile, { version: 1, policyHash: 'wrong', used: 0, lastAttemptAt: 0 }),
    f => f.save(f.accessFile, { ...f.config, maxRequests: 999 }),
  ]) {
    const f = fixture(t); change(f);
    await assert.rejects(f.transport().invoke('search', search), error => ['access_pending', 'access_expired'].includes(error.code));
    assert.equal(f.calls().length, 0);
  }
  assert.throws(() => configuredProvider({ COMMON_GROUND_PROVIDER: 'qloo', QLOO_API_KEY: 'SYNTHETIC' }), { code: 'access_pending' });
});

test('upstream auth, rate and server failures stay distinct, count attempts, hide diagnostics and never retry', async t => {
  for (const [status, code] of [[401, 'authentication_failed'], [403, 'authentication_failed'], [429, 'provider_rate_limited'], [500, 'provider_unavailable']]) {
    const f = fixture(t); const transport = f.transport({ status, body: { message: f.syntheticKey } });
    await assert.rejects(transport.invoke('search', search), error => error.code === code && !error.message.includes(f.syntheticKey));
    assert.equal(f.calls().length, 1); assert.equal(f.budget().used, 1);
  }
  const f = fixture(t);
  await assert.rejects(f.transport({ failure: 'throw' }).invoke('search', search), error => error.code === 'provider_unavailable' && !error.message.includes(f.syntheticKey));
  await assert.rejects(f.transport({ failure: 'redirect' }).invoke('search', search), { code: 'provider_unavailable' });
  assert.equal(f.calls().length, 2); assert.equal(f.budget().used, 2);
});

test('a successful-status response cannot expose an echoed credential through an entity field', async t => {
  const f = fixture(t);
  await assert.rejects(f.transport({ body: { results: [{ ...row(1, 'movie'), name: f.syntheticKey }] } }).invoke('search', search), error => error.code === 'invalid_provider_result' && !error.message.includes(f.syntheticKey));
  assert.equal(f.calls().length, 1); assert.equal(f.budget().used, 1);
});

test('malformed, oversized and excessive upstream results fail without becoming successful empty data', async t => {
  for (const scenario of [
    { rawBody: 'not JSON' }, { body: { results: {} } }, { body: { results: [null] } },
    { body: { results: [1, 2, 3, 4, 5].map(n => row(n, 'movie')) } }, { body: { results: [], errors: ['synthetic'] } },
  ]) {
    const f = fixture(t);
    await assert.rejects(f.transport(scenario).invoke('search', search), { code: 'invalid_provider_result' });
    assert.equal(f.calls().length, 1); assert.equal(f.budget().used, 1);
  }
  const f = fixture(t);
  await assert.rejects(f.transport({ rawBody: 'x'.repeat(1_000_001) }).invoke('search', search), { code: 'provider_response_too_large' });
  assert.equal(f.calls().length, 1);
});

test('request timeout aborts the real child fetch once and keeps its spent allowance', async t => {
  const f = fixture(t); const started = Date.now();
  await assert.rejects(f.transport({ failure: 'timeout' }).invoke('search', search), { code: 'provider_timeout' });
  assert.ok(Date.now() - started < 12000);
  assert.equal(f.calls().length, 1); assert.equal(f.budget().used, 1);
});

test('unsupported commands, excessive options and contact inputs cannot spawn a child', async t => {
  const f = fixture(t); const transport = f.transport();
  for (const [operation, input] of [
    ['search', { ...search, types: 'urn:entity:person' }], ['search', { ...search, query: 'name@example.invalid' }],
    ['search', { ...search, query: 'line\nbreak' }], ['recommend', { ...recommend, signals: ['Arrival'] }],
    ['rank', { ...rank, options: Array.from({ length: 11 }, (_, n) => id(n + 11)) }], ['unknown', {}],
  ]) assert.throws(() => transport.invoke(operation, input), { code: 'invalid_provider_input' });
  assert.equal(f.children(), 0); assert.equal(f.calls().length, 0); assert.equal(f.budget().used, 0);
  assert.equal(qlooCommand('rank', rank).endpoint, '/v2/insights');
});

test('the bounded queue serializes children and rejects excess work before spawning', async () => {
  const children = [];
  const transport = new HarnessTransport({ accessFile: '/synthetic-only/access.json', spawnChild() {
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() {} });
    children.push(child); return child;
  } });
  const pending = Array.from({ length: 12 }, () => transport.invoke('search', search));
  await assert.rejects(transport.invoke('search', search), { code: 'provider_busy' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(children.length, 1);
  for (let index = 0; index < 12; index++) {
    const child = children[index];
    child.stdout.write(JSON.stringify({ ok: true, rows: [] })); child.emit('close', 0);
    await pending[index]; await new Promise(resolve => setImmediate(resolve));
    assert.equal(children.length, Math.min(index + 2, 12));
  }
  assert.equal(transport.pending, 0);
});

test('malformed child output is rejected and the queue can recover for the next request', async () => {
  let executions = 0, killed = 0;
  const transport = new HarnessTransport({ accessFile: '/synthetic-only/access.json', spawnChild() {
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() { killed++; } });
    const output = ++executions === 1 ? 'unstructured CLI diagnostics' : JSON.stringify({ ok: true, rows: [] });
    setImmediate(() => { child.stdout.write(output); child.emit('close', 0); });
    return child;
  } });
  await assert.rejects(transport.invoke('search', search), error => error.code === 'invalid_provider_result' && !error.message.includes('diagnostics'));
  assert.deepEqual(await transport.invoke('search', search), []);
  assert.equal(killed, 1); assert.equal(transport.pending, 0);
});
