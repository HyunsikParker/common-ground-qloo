import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectQlooWorkflowExecutor } from '@qloo/qloo-harness';
import { QlooProvider } from '../server/qloo-provider.js';
import { GroupService } from '../server/service.js';

// These IDs and results are invented. The real pinned harness runs against an
// in-memory API double, with fetch denied; no event credential or network is used.
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, type = 'place', name = `Synthetic place ${n}`) => ({ entity_id: id(n), type: `urn:entity:${type}`, name });
const film = row(1, 'movie', 'Synthetic Arrival film');
const book = row(2, 'book', 'Synthetic Arrival book');
const venues = [11, 12, 13].map(n => row(n));
const all = [film, book, ...venues];
function fixture() {
  const calls = [];
  const client = {
    async searchEntities(query) {
      calls.push({ operation: 'search', query });
      return { results: [film, book].filter(item => item.type === query.types) };
    },
    async entities(values) {
      calls.push({ operation: 'entities', values });
      return { results: all.filter(item => values.includes(item.entity_id)) };
    },
    async insights(query) {
      calls.push({ operation: 'insights', query });
      const profile = query['signal.interests.entities'][0];
      const options = query['filter.results.entities'] ?? venues.map(item => item.entity_id);
      const scores = profile === film.entity_id ? [9, 8, 1] : [1, 8, 9];
      return { results: { entities: venues.filter(item => options.includes(item.entity_id)).map(item => ({ ...item, query: { affinity: scores[venues.indexOf(item)] } })) } };
    },
  };
  const executor = createDirectQlooWorkflowExecutor(client);
  return { client, executor, calls, provider: new QlooProvider({ client, executor, area: 'Manhattan, New York' }) };
}

test('the pinned official harness executes the shared-shortlist pipeline without network', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Network forbidden in contract tests'); });
  const { provider, calls } = fixture(); const service = new GroupService(provider);
  const first = await service.resolve('Arrival');
  assert.deepEqual(first.choices.map(item => item.kind), ['Book', 'Film']);
  service.confirm(first.resolutionId, film.entity_id);
  const second = await service.resolve('Arrival'); service.confirm(second.resolutionId, book.entity_id);
  const groups = [{ id: 'person-1', entityIds: [film.entity_id] }, { id: 'person-2', entityIds: [book.entity_id] }];
  let state = await service.compare(groups);
  assert.equal(state.comparison.candidates[0].id, id(12));
  assert.deepEqual(state.comparison.candidates[0].perMember.map(member => member.rank), [2, 2]);
  const queries = calls.filter(call => call.operation === 'insights').map(call => call.query);
  assert.equal(queries.length, 4);
  for (const query of queries.slice(0, 2)) {
    assert.equal(query['filter.location.query'], 'Manhattan, New York');
    assert.equal(query['filter.type'], 'urn:entity:place');
    assert.equal(query.take, 4);
  }
  for (const query of queries.slice(2)) assert.deepEqual(query['filter.results.entities'], venues.map(item => item.entity_id));
  assert.ok(!JSON.stringify(queries).includes('person-'));
  assert.ok(queries.every(query => !Object.keys(query).some(key => key.includes('demographic'))));
  service.veto(id(12)); state = await service.compare(groups);
  assert.ok(state.comparison.candidates.every(item => item.id !== id(12)));
  assert.equal(service.veto(id(12), true).comparison.candidates[0].id, id(12));
  assert.equal(fetchMock.mock.calls.length, 0);
});

const envelope = (operation, results, extra = {}) => ({ result: { schema_version: '1.0-preview.1', operation, status: 'ok', results, result_count: results.length, ...extra } });
function stub(execute, searchEntities = async () => ({ results: [] })) {
  return new QlooProvider({ client: { searchEntities }, executor: { execute }, area: 'Manhattan, New York' });
}

test('absent or nonnumeric affinities are not fabricated, while unexpected or duplicate options fail', async () => {
  const provider = stub(async () => envelope('rank', [{ ...row(11), affinity: 0 }, { ...row(12), affinity: '0.9' }]));
  assert.deepEqual(await provider.rank([id(1)], [id(11), id(12), id(13)]), { [id(11)]: 0 });
  for (const rows of [[{ ...row(99), affinity: 1 }], [{ ...row(11), affinity: 1 }, { ...row(11), affinity: 2 }]]) {
    await assert.rejects(stub(async () => envelope('rank', rows)).rank([id(1)], [id(11)]), { code: 'invalid_provider_result' });
  }
});

test('needs-input, partial, degraded and incompatible contracts cannot look successful', async () => {
  for (const [extra, expected] of [
    [{ status: 'needs_input' }, 'provider_needs_input'],
    [{ status: 'partial' }, 'provider_incomplete'],
    [{ status: 'degraded' }, 'provider_incomplete'],
    [{ schema_version: 'future-incompatible' }, 'invalid_provider_result'],
    [{ operation: 'recommend' }, 'invalid_provider_result'],
    [{ result_count: 9 }, 'invalid_provider_result'],
  ]) {
    await assert.rejects(stub(async () => envelope('rank', [], extra)).rank([id(1)], [id(11)]), { code: expected });
  }
});

test('authentication, quota and timeout errors remain distinct without raw messages', async () => {
  for (const [failure, code] of [
    [{ code: 'QLOO_AUTH' }, 'authentication_failed'], [{ status: 403 }, 'authentication_failed'],
    [{ code: 'QLOO_RATE_LIMIT' }, 'provider_rate_limited'], [{ status: 429 }, 'provider_rate_limited'],
    [{ code: 'QLOO_TIMEOUT' }, 'provider_timeout'], [{ code: 'UNKNOWN' }, 'provider_unavailable'],
  ]) {
    const provider = stub(async () => { throw { ...failure, message: 'PRIVATE_RAW_PAYLOAD' }; });
    await assert.rejects(provider.rank([id(1)], [id(11)]), error => error.code === code && !error.message.includes('PRIVATE_RAW_PAYLOAD'));
  }
  const provider = stub(async () => {}, async () => { throw { status: 401, message: 'PRIVATE_RAW_PAYLOAD' }; });
  await assert.rejects(provider.search('Arrival'), { code: 'authentication_failed' });
});

test('search shows only supported cultural types and rejects malformed or oversized results', async () => {
  for (const response of [null, {}, { results: [row(11)] }, { results: [book, book] }, { results: [1, 2, 3, 4, 5].map(n => row(n, 'book')) }]) {
    await assert.rejects(stub(async () => {}, async () => response).search('Arrival'), { code: 'invalid_provider_result' });
  }
});

test('unconfirmed names and more than ten options never reach the executor', async () => {
  let executions = 0; const provider = stub(async () => { executions++; });
  await assert.rejects(provider.rank(['Arrival'], [id(11)]), { code: 'invalid_provider_input' });
  await assert.rejects(provider.rank([id(1)], Array.from({ length: 11 }, (_, n) => id(n + 11))), { code: 'invalid_provider_input' });
  await assert.rejects(provider.rank([id(1)], [id(11), id(11)]), { code: 'invalid_provider_input' });
  assert.equal(executions, 0);
});

test('empty recommendations stay empty and cannot become fixture venues', async () => {
  assert.deepEqual(await stub(async () => envelope('recommend', [], { status: 'empty' })).suggest([id(1)]), []);
  assert.throws(() => new QlooProvider({}), { code: 'access_pending' });
});

test('the requested public area reaches nomination without changing a shared provider default', async () => {
  const { provider, calls } = fixture();
  const venues = await provider.suggest([film.entity_id], 'Brooklyn, New York');
  assert.equal(calls.find(item => item.operation === 'insights').query['filter.location.query'], 'Brooklyn, New York');
  assert.ok(venues.every(item => item.area === 'Brooklyn, New York'));
  assert.equal(provider.area, 'Manhattan, New York');
  const before = calls.length;
  await assert.rejects(provider.suggest([film.entity_id], 'person@example.invalid'), { code: 'invalid_area' });
  assert.equal(calls.length, before);
});
