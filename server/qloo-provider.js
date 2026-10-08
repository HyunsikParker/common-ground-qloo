import { AppError } from './errors.js';
import { publicArea } from './area.js';
import { requireVenueType } from './venue-types.js';

const schema = '1.0-preview.1';
const types = new Map([['urn:entity:book', 'Book'], ['urn:entity:movie', 'Film'], ['urn:entity:artist', 'Artist']]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, maximum) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const invalid = () => new AppError('invalid_provider_result', 'Qloo returned a response this version cannot safely compare.', 502);

function ids(values, maximum) {
  if (!Array.isArray(values) || !values.length || values.length > maximum || values.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(values).size !== values.length) {
    throw new AppError('invalid_provider_input', 'Use distinct confirmed Qloo entity IDs within the comparison limit.');
  }
  return [...values];
}

function providerError(error) {
  if (error instanceof AppError) return error;
  if ([401, 403].includes(error?.status)) return new AppError('authentication_failed', 'Qloo access could not be authenticated.', 503);
  if (error?.status === 429) return new AppError('provider_rate_limited', 'Qloo’s request limit was reached. The last completed comparison has been kept.', 429);
  switch (error?.code) {
    case 'QLOO_AUTH': case 'RESOLVER_AUTH': return new AppError('authentication_failed', 'Qloo access could not be authenticated.', 503);
    case 'QLOO_RATE_LIMIT': return new AppError('provider_rate_limited', 'Qloo’s request limit was reached. The last completed comparison has been kept.', 429);
    case 'CANCELLED': case 'QLOO_TIMEOUT': case 'RESOLVER_TIMEOUT': return new AppError('provider_timeout', 'Qloo did not finish in time. The last completed comparison has been kept.', 504);
    case 'TOOL_INPUT': case 'QLOO_CONTRACT': case 'RESOLVER_CONTRACT': return invalid();
    default: return new AppError('provider_unavailable', 'Qloo is unavailable. The last completed comparison has been kept.', 502);
  }
}

function workflowResults(execution, operation) {
  const result = execution?.result;
  if (!result || result.schema_version !== schema || result.operation !== operation) throw invalid();
  if (result.status === 'error') throw providerError(result.error);
  if (result.status === 'needs_input') throw new AppError('provider_needs_input', 'Qloo needs an exact entity match. Search again and confirm the intended work.', 422);
  if (result.status === 'partial' || result.status === 'degraded') throw new AppError('provider_incomplete', 'Qloo could not complete this comparison. The last completed result has been kept.', 502);
  if (!['ok', 'empty'].includes(result.status) || !Array.isArray(result.results) || (result.status === 'empty' && result.results.length)) throw invalid();
  if (result.result_count !== undefined && result.result_count !== result.results.length) throw invalid();
  return result.results;
}

function entity(row) {
  if (!row || typeof row.entity_id !== 'string' || !uuid.test(row.entity_id) || !text(row.name, 180)) throw invalid();
  return { id: row.entity_id, name: text(row.name, 180) };
}

function explanation(row, signals) {
  if (row.explainability === undefined) return null;
  const values = row.explainability?.signals;
  if (!Array.isArray(values) || values.length > signals.length) throw invalid();
  const seen = new Set();
  return values.map(value => {
    const entityId = value?.entity_id;
    if (!signals.includes(entityId) || seen.has(entityId) || !Number.isFinite(value?.score) || value.score < 0 || value.score > 1) throw invalid();
    seen.add(entityId);
    return { entityId, score: value.score };
  });
}

// The caller must supply an approved, budgeted Qloo client and official harness
// executor. There is deliberately no environment lookup or network fallback here.
// configuredProvider requires verified private access before constructing it.
export class QlooProvider {
  mode = 'qloo';
  provenance = 'Qloo aggregate-affinity evidence, ranked separately for each interest profile. These are ordinal comparisons, not individual preference probabilities.';
  constructor({ client, executor, area }) {
    if (typeof client?.searchEntities !== 'function' || typeof executor?.execute !== 'function') throw new AppError('access_pending', 'An approved Qloo client and harness executor are required.', 503);
    this.client = client; this.executor = executor; this.area = publicArea(area);
  }
  async search(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100 || /@|\d{9,}/.test(query)) throw new AppError('invalid_query', 'Search for a public book, film or artist without contact details.');
    const found = new Map();
    try {
      // Three explicit cultural types; no person name, demographic or location signals.
      for (const [type, kind] of types) {
        const response = await this.client.searchEntities({ query: query.trim(), types: type, take: 4 });
        if (!Array.isArray(response?.results) || response.results.length > 4) throw invalid();
        for (const row of response.results) {
          const item = entity(row);
          if (row.type !== type || found.has(item.id)) throw invalid();
          const properties = row.properties ?? {};
          const year = Number.isInteger(properties.release_year) ? String(properties.release_year) : '';
          const description = text(properties.short_description ?? properties.description, 180);
          found.set(item.id, { ...item, kind, detail: [year, description].filter(Boolean).join(' · ') || kind });
        }
      }
      return [...found.values()];
    } catch (error) { throw providerError(error); }
  }
  async suggest(entityIds, area = this.area, venueType) {
    const signals = ids(entityIds, 4);
    const meetingArea = publicArea(area);
    const venue = requireVenueType(venueType);
    try {
      const result = await this.executor.execute('recommend', { target_type: 'place', signals, filter_location: meetingArea, include_tags: [venue.tagId], include_tags_operator: 'union', explain: true, limit: 4 });
      const rows = workflowResults(result, 'recommend');
      if (rows.length > 4) throw invalid();
      const seen = new Set();
      return rows.map(row => {
        const item = entity(row);
        if (row.type !== 'urn:entity:place' || seen.has(item.id)) throw invalid();
        seen.add(item.id);
        return { ...item, kind: venue.label, note: text(row.properties?.short_description ?? row.properties?.description, 300) || 'Qloo did not provide a description.', explanation: explanation(row, signals), area: meetingArea, openingHours: null, price: null };
      });
    } catch (error) { throw providerError(error); }
  }
  async rank(entityIds, candidateIds) {
    const signals = ids(entityIds, 4); const options = ids(candidateIds, 10);
    try {
      const result = await this.executor.execute('rank', { option_type: 'place', options, signals });
      const rows = workflowResults(result, 'rank');
      const scores = {}; const seen = new Set();
      for (const row of rows) {
        const id = row?.entity_id;
        if (!options.includes(id) || seen.has(id) || row.type !== 'urn:entity:place') throw invalid();
        seen.add(id);
        // Absent affinities stay absent. GroupService reports incomplete candidates.
        if (Number.isFinite(row.affinity)) scores[id] = row.affinity;
      }
      return scores;
    } catch (error) { throw providerError(error); }
  }
}
