import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { makeMcpServer } from '../server/mcp.js';
import { GroupService } from '../server/service.js';
import { FixtureProvider } from '../server/fixture-provider.js';

test('a real MCP client resolves, confirms, compares and vetoes through stdio', async t => {
  const client = new Client({ name: 'common-ground-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server/mcp.js', import.meta.url))], env: { COMMON_GROUND_PROVIDER: 'fixture' }, stderr: 'pipe' });
  await client.connect(transport); t.after(() => client.close());
  const tools = await client.listTools(); assert.equal(tools.tools.length, 7);
  const call = async (name, args = {}) => client.callTool({ name, arguments: args });
  let result = await call('search_interests', { query: 'Arrival' }); const choices = result.structuredContent;
  assert.equal(choices.requiresConfirmation, true); assert.equal(choices.choices.length, 2);
  const id = choices.choices[0].id; const groups = [1, 2].map(n => ({ id: `person-${n}`, entityIds: [id] }));
  assert.equal((await call('compare_places', { groups })).isError, true);
  assert.ok(!(await call('confirm_interest', { resolutionId: choices.resolutionId, entityId: id })).isError);
  result = await call('compare_places', { groups }); assert.ok(!result.isError);
  assert.equal(result.structuredContent.mode, 'fixture');
  const venue = result.structuredContent.comparison.candidates[0].id;
  result = await call('exclude_place', { id: venue });
  assert.ok(result.structuredContent.comparison.candidates.every(c => c.id !== venue));
});

test('MCP announces external access only for tools that can request Qloo data', async t => {
  const provider = new FixtureProvider(); provider.mode = 'qloo'; provider.area = 'Manhattan, New York';
  const client = new Client({ name: 'external-access-test', version: '1.0.0' });
  const server = makeMcpServer(new GroupService(provider));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  const tools = (await client.listTools()).tools;
  for (const tool of tools) assert.equal(tool.annotations.openWorldHint, ['search_interests', 'compare_places'].includes(tool.name));
  assert.ok(tools.find(tool => tool.name === 'compare_places').inputSchema.properties.area);
  const state = await client.callTool({ name: 'get_group', arguments: {} });
  assert.equal(state.structuredContent.area, 'Manhattan, New York');
});
