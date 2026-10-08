import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAppServer } from '../server/http.js';

test('HTTP journey binds the session, rejects stale/cross-origin writes, and keeps vetoes', async t => {
  const server = createAppServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const initial = await fetch(`${base}/api/session`); const cookie = initial.headers.get('set-cookie').split(';')[0]; const empty = await initial.json();
  assert.match(initial.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  async function post(path, payload, origin = base) {
    return fetch(`${base}/api/${path}`, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  }
  const rejected = await post('sample', { revision: empty.revision }, 'https://untrusted.example'); assert.equal(rejected.status, 403);
  let response = await post('sample', { revision: empty.revision }); assert.equal(response.status, 200); let state = await response.json();
  const id = state.comparison.candidates[0].id;
  response = await post('exclude', { revision: state.revision, id }); assert.equal(response.status, 200); const excluded = await response.json();
  assert.ok(excluded.comparison.candidates.every(c => c.id !== id));
  assert.equal((await post('restore', { revision: state.revision, id })).status, 409);
  response = await post('compare', { revision: excluded.revision, groups: state.groups, venueType: 'bar' }); state = await response.json();
  assert.ok(state.comparison.candidates.every(c => c.id !== id));
  assert.equal(state.venueType, 'bar');
  const isolated = await (await fetch(`${base}/api/session`)).json(); assert.equal(isolated.comparison, null);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/assets/%2e%2e%2f%2e%2e%2fpackage.json`)).status, 404);
});
