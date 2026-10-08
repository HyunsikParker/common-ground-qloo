import test from 'node:test';
import assert from 'node:assert/strict';
import { GroupService } from '../server/service.js';
import { FixtureProvider } from '../server/fixture-provider.js';
import { AppError, publicError } from '../server/errors.js';
import { configuredProvider } from '../server/provider.js';

test('an ambiguous search cannot silently become a confirmed interest', async () => {
  const service = new GroupService(); const found = await service.resolve('Arrival');
  assert.equal(found.choices.length, 2); assert.equal(found.requiresConfirmation, true);
  const groups = [1, 2].map(i => ({ id: `person-${i}`, entityIds: [found.choices[0].id] }));
  await assert.rejects(service.compare(groups), { code: 'unconfirmed_entity' });
  service.confirm(found.resolutionId, found.choices[0].id);
  assert.equal((await service.compare(groups)).comparison.status, 'ready');
  assert.throws(() => service.confirm(found.resolutionId, found.choices[1].id), { code: 'invalid_confirmation' });
});
test('unlisted choice IDs and contact details are rejected', async () => {
  const service = new GroupService(); const found = await service.resolve('Arrival');
  assert.throws(() => service.confirm(found.resolutionId, 'someone-else'), { code: 'invalid_confirmation' });
  await assert.rejects(service.resolve('person@example.com'), { code: 'invalid_query' });
});
test('sample provenance is explicit and exclusions persist across new comparisons', async () => {
  const service = new GroupService(); let state = await service.sample();
  assert.equal(state.mode, 'fixture'); assert.match(state.provenance, /invented/);
  const excluded = state.comparison.candidates[0].id; service.veto(excluded);
  state = await service.compare(state.groups);
  assert.ok(state.comparison.candidates.every(c => c.id !== excluded));
  assert.equal(service.veto(excluded, true).comparison.candidates[0].id, excluded);
});
test('provider authentication/rate-limit failures are distinct and cannot install fake successful data', async () => {
  for (const [code, status] of [['authentication_failed', 401], ['provider_rate_limited', 429]]) {
    const provider = new FixtureProvider(); const service = new GroupService(provider); const prior = await service.sample();
    provider.suggest = async () => { throw new AppError(code, 'Provider unavailable.', status); };
    await assert.rejects(service.compare(prior.groups), { code });
    assert.deepEqual(service.state(), prior);
  }
});
test('provider gets only confirmed cultural IDs, never member labels', async () => {
  const provider = new FixtureProvider(); const seen = []; const original = provider.suggest.bind(provider);
  provider.suggest = async ids => { seen.push(ids); return original(ids); };
  const service = new GroupService(provider); await service.sample();
  assert.equal(seen.length, 3); assert.ok(seen.flat().every(id => id.startsWith('fixture:')));
});
test('reset clears group, confirmations and exclusions', async () => {
  const service = new GroupService(); const state = await service.sample(); service.veto(state.comparison.candidates[0].id);
  const empty = service.reset(); assert.equal(empty.comparison, null); assert.deepEqual(empty.entities, []);
  await assert.rejects(service.compare(state.groups), { code: 'unconfirmed_entity' });
});
test('live mode fails closed and cannot use ambient credentials or sample fallback', () => {
  assert.throws(() => configuredProvider({ COMMON_GROUND_PROVIDER: 'qloo', QLOO_API_KEY: 'not-a-real-key' }), { code: 'access_pending' });
  assert.throws(() => configuredProvider({ COMMON_GROUND_PROVIDER: 'typo' }), { code: 'invalid_provider' });
  assert.equal(configuredProvider({ QLOO_API_KEY: 'not-a-real-key' }).mode, 'fixture');
});
test('unexpected provider errors are redacted instead of leaking response data', () => {
  const result = publicError(new Error('credential material or personal data'));
  assert.equal(result.status, 500); assert.ok(!JSON.stringify(result).includes('credential material'));
});

test('meeting areas are session-specific and invalid or failed changes preserve the prior comparison', async () => {
  const provider = new FixtureProvider(); provider.mode = 'qloo'; provider.area = 'Manhattan, New York';
  const areas = []; const original = provider.suggest.bind(provider);
  provider.suggest = async (ids, area) => { areas.push(area); return original(ids); };
  const first = new GroupService(provider), second = new GroupService(provider);
  async function prepare(service) {
    const found = await service.resolve('Arrival');service.confirm(found.resolutionId, found.choices[0].id);
    return [1, 2].map(n => ({ id: `person-${n}`, entityIds: [found.choices[0].id] }));
  }
  const a = await prepare(first), b = await prepare(second);
  const before = await first.compare(a, 'Brooklyn, New York');
  await second.compare(b, 'Paris');
  assert.equal(first.state().area, 'Brooklyn, New York');
  assert.equal(second.state().area, 'Paris');
  assert.equal(provider.area, 'Manhattan, New York');
  assert.deepEqual(areas, ['Brooklyn, New York', 'Brooklyn, New York', 'Paris', 'Paris']);
  for (const area of ['', 'a', 'person@example.invalid', '1234567890', 'New York\nprivate', 'x'.repeat(101)]) {
    await assert.rejects(first.compare(a, area), { code: 'invalid_area' });
    assert.deepEqual(first.state(), before);
  }
  provider.suggest = async () => { throw new AppError('provider_rate_limited', 'Pause.', 429); };
  await assert.rejects(first.compare(a, 'London'), { code: 'provider_rate_limited' });
  assert.deepEqual(first.state(), before);
  assert.equal(first.reset().area, 'Manhattan, New York');
});

test('fictional venues cannot be presented as recommendations for a real area', async () => {
  const service = new GroupService(); const state = await service.sample();
  await assert.rejects(service.compare(state.groups, 'Paris'), { code: 'area_unavailable' });
  assert.deepEqual(service.state(), state);
});

const syntheticSnapshot = {
  version: 1,
  capturedAt: '2026-10-08T12:00:00.000Z',
  area: 'Manhattan, New York',
  venueType: 'cafe',
  entities: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Arrival', kind: 'Film', detail: 'Synthetic test record' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Miles Davis', kind: 'Artist', detail: 'Synthetic test record' },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Brian Eno', kind: 'Artist', detail: 'Synthetic test record' },
  ],
  groups: [1, 2, 3].map(n => ({ id: `person-${n}`, entityIds: [`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`] })),
  evidence: {
    candidates: [
      { id: 'a', name: 'Synthetic A', kind: 'Cafe', note: 'Invented test venue.', explanations: [{ memberId: 'person-1', contributions: [{ entityId: '00000000-0000-4000-8000-000000000001', score: 1 }] }] },
      { id: 'b', name: 'Synthetic B', kind: 'Cafe', note: 'Invented test venue.', explanations: [] },
    ],
    scores: {
      'person-1': { a: 2, b: 1 },
      'person-2': { a: 1, b: 2 },
      'person-3': { a: 1, b: 2 },
    },
    pool: { nominatedCount: 2, omittedCount: 0, limit: 10 },
  },
};

test('the public example snapshot is shared across sessions, costs no provider requests and retains local vetoes', async () => {
  let suggestions = 0; let rankings = 0;
  const provider = { mode: 'qloo', area: 'Manhattan, New York', provenance: 'Synthetic test only', async suggest() { suggestions++; return []; }, async rank() { rankings++; return {}; } };
  const first = new GroupService(provider); const second = new GroupService(provider);
  let state = await first.publicExample(syntheticSnapshot);
  assert.deepEqual(state.entities.map(item => item.name), ['Arrival', 'Miles Davis', 'Brian Eno']);
  assert.equal(state.comparison.evidenceSource, 'snapshot');
  assert.equal(state.comparison.evidenceAt, syntheticSnapshot.capturedAt);
  first.veto('a'); state = await first.publicExample(syntheticSnapshot);
  assert.ok(state.comparison.candidates.every(item => item.id !== 'a'));
  assert.equal((await second.publicExample(syntheticSnapshot)).comparison.candidates.length, 2);
  assert.equal(suggestions, 0); assert.equal(rankings, 0);
});

test('venue type is forwarded, separates the comparison cache and resets to cafe', async () => {
  const provider = new FixtureProvider(); provider.mode = 'qloo'; provider.area = 'Manhattan, New York';
  const seen = []; const original = provider.suggest.bind(provider);
  provider.suggest = async (ids, area, venueType) => { seen.push({ area, venueType }); return original(ids); };
  const service = new GroupService(provider); const found = await service.resolve('Arrival');
  service.confirm(found.resolutionId, found.choices[0].id);
  const groups = [1, 2].map(n => ({ id: `person-${n}`, entityIds: [found.choices[0].id] }));
  await service.compare(groups, 'Brooklyn, New York', 'cafe');
  await service.compare(groups, 'Brooklyn, New York', 'cafe');
  const state = await service.compare(groups, 'Brooklyn, New York', 'bar');
  assert.deepEqual(seen, [
    { area: 'Brooklyn, New York', venueType: 'cafe' },
    { area: 'Brooklyn, New York', venueType: 'cafe' },
    { area: 'Brooklyn, New York', venueType: 'bar' },
    { area: 'Brooklyn, New York', venueType: 'bar' },
  ]);
  assert.equal(state.venueType, 'bar');
  const before = service.state();
  await assert.rejects(service.compare(groups, 'Brooklyn, New York', 'landmark'), { code: 'invalid_venue_type' });
  assert.deepEqual(service.state(), before);
  assert.equal(service.reset().venueType, 'cafe');
});
