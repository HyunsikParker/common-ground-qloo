import { AppError } from './errors.js';

// The Qloo harness rank schema accepts at most ten options. Keep every person's
// first nomination, then prefer shared nominations; never compare raw affinities.
export function candidatePool(nominations, limit = 10) {
  const places = new Map(); const first = new Set(); const votes = new Map();
  for (const list of nominations) {
    if (!Array.isArray(list) || list.length > 4 || list.some(p => !p || typeof p.id !== 'string') || new Set(list.map(p => p.id)).size !== list.length) {
      throw new AppError('invalid_provider_result', 'The provider returned an invalid candidate set.', 502);
    }
    list.forEach((place, position) => {
      if (!place || typeof place.id !== 'string' || !place.id || typeof place.name !== 'string') throw new AppError('invalid_provider_result', 'The provider returned an invalid place.', 502);
      places.set(place.id, place);
      if (position === 0) first.add(place.id);
      const vote = votes.get(place.id) ?? { support: 0, positionSum: 0 };
      vote.support++; vote.positionSum += position; votes.set(place.id, vote);
    });
  }
  if (first.size > limit) throw new AppError('candidate_budget', 'The candidate budget cannot preserve everyone’s first nomination.', 502);
  const remainder = [...places.keys()].filter(id => !first.has(id)).sort((a, b) => {
    const av = votes.get(a), bv = votes.get(b);
    return bv.support - av.support || av.positionSum - bv.positionSum || a.localeCompare(b, 'en');
  });
  const selected = [...first, ...remainder.slice(0, limit - first.size)].sort((a, b) => a.localeCompare(b, 'en'));
  return { candidates: selected.map(id => places.get(id)), nominatedCount: places.size, omittedCount: places.size - selected.length, limit };
}
