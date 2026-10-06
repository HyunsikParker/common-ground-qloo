import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCommonGround } from '../server/ranking.js';
const candidates = ['a', 'b', 'c'].map(id => ({ id, name: id }));
const members = [{ id: 'person-1' }, { id: 'person-2' }];
const scores = { 'person-1': { a: 100, b: 2, c: 1 }, 'person-2': { a: 0, b: 1, c: 2 } };
const rank = (extra = {}) => rankCommonGround({ candidates, members, scores, ...extra });

test('minimax selects the compromise even when raw-score averaging would favor an extreme', () => {
  const result = rank(); assert.equal(result.candidates[0].id, 'b'); assert.equal(result.candidates[0].worstRank, 2);
});
test('independent positive rescaling of a member does not change the compromise', () => {
  const transformed = { ...scores, 'person-1': { a: 100007, b: 2007, c: 1007 } };
  assert.deepEqual(rank({ scores: transformed }), rank());
});
test('member and candidate order do not change the venue order', () => {
  assert.deepEqual(rank({ members: [...members].reverse(), candidates: [...candidates].reverse() }).candidates.map(c => c.id), rank().candidates.map(c => c.id));
});
test('all tied evidence has zero regret and a stable deterministic tie-break', () => {
  const tied = Object.fromEntries(members.map(m => [m.id, { a: 2, b: 2, c: 2 }]));
  const result = rank({ scores: tied });
  assert.deepEqual(result.candidates.map(c => c.id), ['a', 'b', 'c']);
  assert.ok(result.candidates.every(c => c.worstRegret === 0 && c.worstRank === 1));
});
test('incomplete evidence is not imputed or compared on different candidate sets', () => {
  const result = rank({ scores: { ...scores, 'person-2': { a: 0, c: 2 } } });
  assert.equal(result.status, 'partial'); assert.equal(result.comparisonSize, 2);
  assert.deepEqual(result.incomplete.map(c => c.id), ['b']);
  assert.ok(result.candidates.every(c => c.perMember.length === 2 && c.perMember.every(p => p.rank <= 2)));
});
test('exclusion is applied before ranking, even with cached scores', () => {
  const result = rank({ excluded: ['b'] }); assert.ok(result.candidates.every(c => c.id !== 'b'));
  assert.deepEqual(result.excluded.map(c => c.id), ['b']);
});
test('zero or one remaining candidate is finite and does not divide by zero', () => {
  assert.equal(rank({ excluded: ['a', 'b', 'c'] }).status, 'empty');
  const [only] = rank({ excluded: ['a', 'b'] }).candidates;
  assert.equal(only.worstRegret, 0); assert.equal(only.meanRegret, 0);
});
test('duplicate candidates fail closed', () => assert.throws(() => rank({ candidates: [candidates[0], candidates[0]] }), /duplicate candidates/));
test('permutation invariance across varying group sizes and synthetic evidence', () => {
  let seed = 7727; const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % 13; };
  for (let n = 2; n <= 6; n++) for (let trial = 0; trial < 30; trial++) {
    const cs = Array.from({ length: 9 }, (_, i) => ({ id: `place-${i}`, name: `place-${i}` }));
    const ms = Array.from({ length: n }, (_, i) => ({ id: `person-${i + 1}` }));
    const ss = Object.fromEntries(ms.map(m => [m.id, Object.fromEntries(cs.map(c => [c.id, next()]))]));
    const a = rankCommonGround({ candidates: cs, members: ms, scores: ss }).candidates;
    const b = rankCommonGround({ candidates: [...cs].reverse(), members: [...ms].reverse(), scores: ss }).candidates;
    assert.deepEqual(a.map(c => [c.id, c.meanRegret, c.worstRegret]), b.map(c => [c.id, c.meanRegret, c.worstRegret]));
  }
});
