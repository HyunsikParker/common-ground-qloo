import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { GroupService } from './service.js';
import { configuredProvider } from './provider.js';
import { publicError } from './errors.js';
import { VENUE_TYPES } from './venue-types.js';

export function makeMcpServer(service = new GroupService(configuredProvider())) {
  const server = new McpServer({ name: 'common-ground', version: '0.1.0' });
  const add = (name, description, inputSchema, action, readOnlyHint = false, external = false) => server.registerTool(name, {
    description, inputSchema, annotations: { readOnlyHint, destructiveHint: false, openWorldHint: external && service.provider.mode === 'qloo' },
  }, args => service.enqueue(async () => {
    try {
      const result = await action(args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    } catch (error) {
      const result = publicError(error).error;
      return { isError: true, content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    }
  }));
  add('get_group', 'Read the current anonymous group, excluded venues and data provenance. Fixture data is never live Qloo evidence.', {}, () => service.state(), true);
  add('search_interests', 'Find candidate public books, films or artists. In Qloo mode this sends the query to Qloo. Show choices to the user; do not automatically accept the first result or submit personal contact details.', { query: z.string().min(2).max(100) }, ({ query }) => service.resolve(query), false, true);
  add('confirm_interest', 'Confirm the exact cultural work the user selected. A materially ambiguous match must be resolved by the user before calling this tool.', { resolutionId: z.string().uuid(), entityId: z.string() }, ({ resolutionId, entityId }) => service.confirm(resolutionId, entityId));
  add('compare_places', 'Compare a common set of places for two to six anonymous people using confirmed interest IDs. In Qloo mode this sends those public IDs and the public meeting area to Qloo. Rank regret is an ordinal compromise measure, not a personal probability. Does not book, purchase or message.', {
    groups: z.array(z.object({ id: z.string().regex(/^person-[1-6]$/), entityIds: z.array(z.string()).min(1).max(4) })).min(2).max(6),
    area: z.string().min(2).max(100).optional().describe('Public city or neighborhood. Do not include contact details or a personal address.'),
    venueType: z.enum(VENUE_TYPES.map(item => item.id)).optional().describe('Type of meeting place: cafe, bar, restaurant or music-venue.'),
  }, ({ groups, area, venueType }) => service.compare(groups, area, venueType), false, true);
  add('exclude_place', 'Exclude a venue the user rejected. It stays excluded across later comparisons until explicitly restored or the group is reset.', { id: z.string() }, ({ id }) => service.veto(id));
  add('restore_place', 'Restore a previously excluded venue only when the user asks to reconsider it.', { id: z.string() }, ({ id }) => service.veto(id, true));
  add('reset_group', 'Start over and clear this local group, confirmations and exclusions when requested.', {}, () => service.reset());
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await makeMcpServer().connect(new StdioServerTransport()); }
  catch (error) { console.error(publicError(error).error.message); process.exitCode = 1; }
}
