import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatePool } from '../server/candidate-pool.js';
const place = id => ({ id, name: id });
test('six disjoint nominations fit the real ten-option contract without losing any first choice', () => {
  const lists = Array.from({ length: 6 }, (_, m) => Array.from({ length: 4 }, (_, n) => place(`p-${m}-${n}`)));
  const result = candidatePool(lists);
  assert.equal(result.candidates.length, 10); assert.equal(result.omittedCount, 14);
  assert.ok(lists.every(list => result.candidates.some(p => p.id === list[0].id)));
  assert.deepEqual(candidatePool([...lists].reverse()), result);
});
test('shared support, not cross-person affinity averages, chooses additional nominations', () => {
  const result = candidatePool([[place('a'), place('shared'), place('x')], [place('b'), place('shared'), place('y')]], 3);
  assert.deepEqual(result.candidates.map(p => p.id), ['a', 'b', 'shared']);
});
test('duplicates within a single provider list cannot inflate support', () => {
  assert.throws(() => candidatePool([[place('a'), place('a')]]), { code: 'invalid_provider_result' });
});
