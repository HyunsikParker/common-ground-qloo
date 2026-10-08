import { AppError } from './errors.js';
import { VENUE_TYPES } from './venue-types.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const culturalTypes = ['urn:entity:book', 'urn:entity:movie', 'urn:entity:artist'];
const venueTags = new Set(VENUE_TYPES.map(item => item.tagId));
function fail() { throw new AppError('invalid_provider_input', 'The Qloo request is outside the supported group-choice operations.'); }
function publicText(value) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.length > 100 || /[\u0000-\u001f\u007f@]|\d{9,}/.test(value)) fail();
  return value.trim();
}
function ids(values, maximum) {
  if (!Array.isArray(values) || !values.length || values.length > maximum || values.some(value => typeof value !== 'string' || !uuid.test(value)) || new Set(values).size !== values.length) fail();
  return values;
}

export function qlooCommand(operation, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
  if (operation === 'search') {
    const query = publicText(input.query);
    if (!culturalTypes.includes(input.types) || input.take !== 4) fail();
    return { endpoint: '/search', take: 4, argv: ['api', 'search', `--query=${query}`, `--type=${input.types}`, '--take=4', '--json'] };
  }
  const signals = ids(input.signals, 4);
  let take, params = { 'signal.interests.entities': signals };
  if (operation === 'recommend') {
    if (input.target_type !== 'place' || input.limit !== 4 || input.explain !== true || input.include_tags_operator !== 'union' || !Array.isArray(input.include_tags) || input.include_tags.length !== 1 || !venueTags.has(input.include_tags[0])) fail();
    take = 4; params['filter.location.query'] = publicText(input.filter_location); params['filter.tags'] = input.include_tags; params['operator.filter.tags'] = 'union'; params['feature.explainability'] = true;
  } else if (operation === 'rank') {
    if (input.option_type !== 'place') fail();
    params['filter.results.entities'] = ids(input.options, 10); take = input.options.length;
  } else fail();
  return { endpoint: '/v2/insights', take, argv: ['api', 'insights', '--type=place', `--take=${take}`, `--params=${JSON.stringify(params)}`, '--json'] };
}
