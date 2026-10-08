import { AppError } from './errors.js';

export const DEFAULT_VENUE_TYPE = 'cafe';

export const VENUE_TYPES = Object.freeze([
  Object.freeze({ id: 'cafe', label: 'Cafe', tagId: 'urn:tag:genre:place:restaurant:cafe' }),
  Object.freeze({ id: 'bar', label: 'Bar', tagId: 'urn:tag:genre:place:restaurant:bar' }),
  Object.freeze({ id: 'restaurant', label: 'Restaurant', tagId: 'urn:tag:genre:place:restaurant' }),
  Object.freeze({ id: 'music-venue', label: 'Live music venue', tagId: 'urn:tag:genre:place:live_music_venue' }),
]);

const byId = new Map(VENUE_TYPES.map(item => [item.id, item]));

export function requireVenueType(value = DEFAULT_VENUE_TYPE) {
  const venue = typeof value === 'string' ? byId.get(value) : undefined;
  if (!venue) throw new AppError('invalid_venue_type', 'Choose cafe, bar, restaurant or live music venue.');
  return venue;
}
