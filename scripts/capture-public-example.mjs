import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuredProvider } from '../server/provider.js';
import { candidatePool } from '../server/candidate-pool.js';
import { rankCommonGround } from '../server/ranking.js';
import { PUBLIC_EXAMPLE_ENTITIES, PUBLIC_EXAMPLE_GROUPS } from '../server/public-example.js';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/capture-public-example.mjs /absolute/path/to/access.json');
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
if (source.version !== 2 || source.eventAccessVerified !== true || source.feeNoticeReceived !== false || source.limitBasis !== 'operator' || source.maxRequests !== 1000 || source.minIntervalMs !== 1000 || source.suspended !== true) {
  throw new Error('The expected suspended event-access policy was not found.');
}

const area = 'Manhattan, New York';
const venueType = 'cafe';
const scratch = mkdtempSync(join(tmpdir(), 'common-ground-example-capture-'));

function ordinalize(values, candidateIds) {
  const finite = candidateIds.flatMap(id => Number.isFinite(values[id]) ? [values[id]] : []);
  const ascending = [...new Set(finite)].sort((a, b) => a - b);
  return Object.fromEntries(candidateIds.flatMap(id => Number.isFinite(values[id]) ? [[id, ascending.indexOf(values[id]) + 1]] : []));
}

try {
  const accessFile = join(realpathSync(scratch), 'access.json');
  writeFileSync(accessFile, JSON.stringify({ ...source, suspended: false }), { mode: 0o600 });
  const before = JSON.parse(readFileSync(source.budgetFile, 'utf8')).used;
  const provider = configuredProvider({ COMMON_GROUND_PROVIDER: 'qloo', COMMON_GROUND_ACCESS_FILE: accessFile, COMMON_GROUND_DEFAULT_AREA: area });
  const groups = structuredClone(PUBLIC_EXAMPLE_GROUPS);
  const nominations = [];

  for (const member of groups) {
    const places = await provider.suggest(member.entityIds, area, venueType);
    nominations.push(places.map(place => {
      const { explanation, ...candidate } = place;
      return { ...candidate, explanations: explanation ? [{ memberId: member.id, contributions: explanation }] : [] };
    }));
  }

  const pool = candidatePool(nominations);
  const candidateIds = pool.candidates.map(candidate => candidate.id);
  const scores = {};
  for (const member of groups) scores[member.id] = ordinalize(await provider.rank(member.entityIds, candidateIds), candidateIds);

  const after = JSON.parse(readFileSync(source.budgetFile, 'utf8')).used;
  if (after - before !== 6) throw new Error(`Expected six Qloo requests; observed ${after - before}.`);
  const snapshot = {
    version: 1,
    capturedAt: new Date().toISOString(),
    area,
    venueType,
    entities: structuredClone(PUBLIC_EXAMPLE_ENTITIES),
    groups,
    evidence: {
      candidates: pool.candidates,
      scores,
      pool: { nominatedCount: pool.nominatedCount, omittedCount: pool.omittedCount, limit: pool.limit },
    },
  };
  rankCommonGround({ ...snapshot.evidence, members: groups, excluded: [] });
  process.stdout.write(JSON.stringify({ snapshot, allowance: { before, after, calls: after - before } }, null, 2) + '\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
