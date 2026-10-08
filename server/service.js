import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import { rankCommonGround } from './ranking.js';
import { entities, sampleGroup, FixtureProvider } from './fixture-provider.js';
import { candidatePool } from './candidate-pool.js';
import { publicArea } from './area.js';
import { DEFAULT_VENUE_TYPE, VENUE_TYPES, requireVenueType } from './venue-types.js';
import { PUBLIC_EXAMPLE_SNAPSHOT } from './public-example.js';

const signatureFor = (area, venueType, members) => JSON.stringify({ area, venueType, members: [...members].sort((a, b) => a.id.localeCompare(b.id)) });

export function validateGroups(groups, confirmed) {
  if (!Array.isArray(groups) || groups.length < 2 || groups.length > 6) throw new AppError('invalid_group', 'Add two to six people.');
  const ids = new Set();
  return groups.map(g => {
    if (!g || !/^person-[1-6]$/.test(g.id) || ids.has(g.id)) throw new AppError('invalid_group', 'Each person needs a distinct group position.');
    ids.add(g.id);
    if (!Array.isArray(g.entityIds) || g.entityIds.length < 1 || g.entityIds.length > 4 || new Set(g.entityIds).size !== g.entityIds.length) {
      throw new AppError('missing_interests', 'Choose one to four different interests for each person.');
    }
    if (g.entityIds.some(id => !confirmed.has(id))) throw new AppError('unconfirmed_entity', 'Confirm every cultural match before comparing places.');
    return { id: g.id, entityIds: [...g.entityIds].sort() };
  });
}

export class GroupService {
  constructor(provider = new FixtureProvider()) {
    this.provider = provider; this.revision = 0; this.confirmed = new Map(); this.resolutions = new Map();
    this.groups = []; this.excluded = new Set(); this.evidence = null; this.tail = Promise.resolve();
    this.area = provider.area ?? 'Example neighborhood';
    this.venueType = DEFAULT_VENUE_TYPE;
  }
  enqueue(action) {
    const pending = this.tail.then(action); this.tail = pending.catch(() => {}); return pending;
  }
  state() {
    return { mode: this.provider.mode, provenance: this.provider.provenance, area: this.area, venueType: this.venueType,
      venueTypes: VENUE_TYPES.map(({ id, label }) => ({ id, label })), revision: this.revision,
      groups: this.groups, entities: [...this.confirmed.values()], comparison: this.result() };
  }
  result() {
    return this.evidence ? { ...rankCommonGround({ ...this.evidence, excluded: [...this.excluded] }), pool: this.evidence.pool, provenance: this.provider.provenance, evidenceSource: this.evidence.source ?? null, evidenceAt: this.evidence.generatedAt ? new Date(this.evidence.generatedAt).toISOString() : null } : null;
  }
  async resolve(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100 || /@|\d{9,}/.test(query)) {
      throw new AppError('invalid_query', 'Search for a public book, film or artist using 2–100 characters. Do not enter contact details.');
    }
    const choices = await this.provider.search(query.trim());
    const resolutionId = randomUUID();
    if (this.resolutions.size >= 30) this.resolutions.delete(this.resolutions.keys().next().value);
    this.resolutions.set(resolutionId, { choices, expires: Date.now() + 10 * 60_000 });
    return { resolutionId, requiresConfirmation: true, choices, provenance: this.provider.provenance };
  }
  confirm(resolutionId, entityId) {
    const resolution = this.resolutions.get(resolutionId);
    const entity = resolution?.choices.find(e => e.id === entityId);
    if (!entity || resolution.expires < Date.now()) throw new AppError('invalid_confirmation', 'Search again and choose the exact matching work.');
    this.confirmed.set(entity.id, entity); this.resolutions.delete(resolutionId); this.revision++;
    return { entity, revision: this.revision };
  }
  async compare(groups, area = this.area, venueType = this.venueType) {
    const members = validateGroups(groups, this.confirmed);
    const meetingArea = this.provider.mode === 'qloo' ? publicArea(area) : 'Example neighborhood';
    const selectedVenueType = requireVenueType(venueType).id;
    if (this.provider.mode !== 'qloo' && area !== meetingArea) throw new AppError('area_unavailable', 'The fictional sample is available only in its example neighborhood.');
    const signature = signatureFor(meetingArea, selectedVenueType, members);
    if (this.provider.mode === 'qloo' && this.evidence?.signature === signature && (this.evidence.source === 'snapshot' || Date.now() - this.evidence.generatedAt < 10 * 60000)) { this.groups = members; this.venueType = selectedVenueType; this.revision++; return this.state(); }
    const nominations = [];
    // Sequential, bounded provider calls. No burst parallelism against an event quota.
    for (const member of [...members].sort((a, b) => a.id.localeCompare(b.id))) {
      const suggestions = await this.provider.suggest(member.entityIds, meetingArea, selectedVenueType);
      nominations.push(suggestions.map(place => {
        const { explanation, ...candidate } = place;
        return { ...candidate, explanations: explanation ? [{ memberId: member.id, contributions: explanation }] : [] };
      }));
    }
    const pool = candidatePool(nominations);
    const candidates = pool.candidates;
    const scores = {};
    for (const member of members) scores[member.id] = candidates.length ? await this.provider.rank(member.entityIds, candidates.map(p => p.id)) : {};
    // Commit only a fully completed provider transaction; a failed refresh never installs partial output.
    this.groups = members; this.area = meetingArea; this.venueType = selectedVenueType; this.evidence = { candidates, members, scores, signature, generatedAt: Date.now(), source: this.provider.mode === 'qloo' ? 'live' : 'fixture', pool: { nominatedCount: pool.nominatedCount, omittedCount: pool.omittedCount, limit: pool.limit } }; this.revision++;
    return this.state();
  }
  veto(id, restore = false) {
    if (!this.evidence?.candidates.some(p => p.id === id)) throw new AppError('unknown_candidate', 'That venue is not in the current comparison.');
    if (restore) this.excluded.delete(id); else this.excluded.add(id);
    this.revision++; return this.state();
  }
  async sample() {
    if (this.provider.mode !== 'fixture') throw new AppError('sample_unavailable', 'Samples are not live Qloo results.', 409);
    this.reset();
    for (const item of entities) { const entity = { id: item.id, name: item.name, kind: item.kind, detail: item.detail }; this.confirmed.set(entity.id, entity); }
    return this.compare(structuredClone(sampleGroup));
  }
  async publicExample(snapshot = PUBLIC_EXAMPLE_SNAPSHOT) {
    if (this.provider.mode !== 'qloo') throw new AppError('sample_unavailable', 'Use the fictional sample in sample mode.', 409);
    const copy = snapshot ? structuredClone(snapshot) : null;
    const captured = Date.parse(copy?.capturedAt);
    if (copy?.version !== 1 || !Number.isFinite(captured) || !Array.isArray(copy.entities) || !Array.isArray(copy.groups) || !copy.evidence) throw new AppError('sample_unavailable', 'The public example snapshot is unavailable.', 503);
    const confirmed = new Map(copy.entities.map(entity => [entity.id, entity]));
    if (confirmed.size !== copy.entities.length) throw new AppError('sample_unavailable', 'The public example snapshot is invalid.', 503);
    const groups = validateGroups(copy.groups, confirmed);
    const area = publicArea(copy.area); const venueType = requireVenueType(copy.venueType).id;
    const evidence = { ...copy.evidence, members: groups, signature: signatureFor(area, venueType, groups), generatedAt: captured, source: 'snapshot' };
    rankCommonGround({ ...evidence, excluded: [] });
    const candidateIds = new Set(evidence.candidates.map(candidate => candidate.id));
    this.confirmed = confirmed; this.resolutions.clear(); this.groups = groups; this.area = area; this.venueType = venueType; this.evidence = evidence;
    this.excluded = new Set([...this.excluded].filter(id => candidateIds.has(id))); this.revision++;
    return this.state();
  }
  reset() {
    this.groups = []; this.confirmed.clear(); this.resolutions.clear(); this.excluded.clear(); this.evidence = null; this.area = this.provider.area ?? 'Example neighborhood'; this.venueType = DEFAULT_VENUE_TYPE; this.revision++;
    return this.state();
  }
}
