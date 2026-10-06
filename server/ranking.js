import { AppError } from './errors.js';

// Ordinal comparisons within each person's evidence only. Never average Qloo affinities.
export function rankCommonGround({ candidates, members, scores, excluded = [] }) {
  if (members.length < 2 || new Set(members.map(m => m.id)).size !== members.length) {
    throw new AppError('invalid_group', 'Use at least two distinct people.');
  }
  if (new Set(candidates.map(c => c.id)).size !== candidates.length) {
    throw new AppError('invalid_provider_result', 'The provider returned duplicate candidates.', 502);
  }
  const vetoes = new Set(excluded);
  const visible = candidates.filter(c => !vetoes.has(c.id));
  const incomplete = visible.filter(c => members.some(m => !Number.isFinite(scores[m.id]?.[c.id])));
  const missing = new Set(incomplete.map(c => c.id));
  const comparable = visible.filter(c => !missing.has(c.id));
  const denominator = Math.max(1, comparable.length - 1);
  const ranked = comparable.map(candidate => {
    const perMember = members.map(member => {
      const value = scores[member.id][candidate.id];
      // Competition rank: equal evidence gets equal rank; all-tied evidence has zero regret.
      const rank = 1 + comparable.filter(c => scores[member.id][c.id] > value).length;
      return { memberId: member.id, rank, regret: (rank - 1) / denominator };
    });
    return {
      ...candidate, perMember,
      worstRegret: Math.max(...perMember.map(m => m.regret)),
      meanRegret: perMember.reduce((sum, m) => sum + m.rank - 1, 0) / members.length / denominator,
      worstRank: Math.max(...perMember.map(m => m.rank)),
    };
  });
  ranked.sort((a, b) => a.worstRegret - b.worstRegret || a.meanRegret - b.meanRegret || a.id.localeCompare(b.id, 'en'));
  return {
    status: incomplete.length ? 'partial' : ranked.length ? 'ready' : 'empty',
    candidates: ranked,
    excluded: candidates.filter(c => vetoes.has(c.id)),
    incomplete: incomplete.map(c => ({ id: c.id, name: c.name, reason: 'Comparable evidence is missing for at least one person.' })),
    comparisonSize: comparable.length,
    method: 'Minimize the worst ordinal rank regret, then mean regret; stable venue ID breaks exact ties.',
  };
}
