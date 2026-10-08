import React, { useState } from 'react';
import { personName } from './GroupEditor.jsx';

function evidenceTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'an unknown time';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }).format(date);
}

export function Comparison({ comparison, members, entities, onExclude, onRestore, disabled, dirty }) {
  const [selected, setSelected] = useState(null);
  const activeId = comparison?.candidates.some(c => c.id === selected) ? selected : comparison?.candidates[0]?.id ?? null;
  const detail = comparison?.candidates.find(c => c.id === activeId);
  const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
  const interestsFor = member => member.entityIds.map(id => entityLookup.get(id)?.name ?? 'Confirmed interest');
  return <section className="comparison" aria-labelledby="shortlist-title">
    <div className="section-heading"><h2 id="shortlist-title">2. Compare the shortlist</h2>{comparison && <span>{comparison.comparisonSize} comparable places</span>}</div>
    {!comparison ? <div className="empty-state">
      <div className="empty-number">A place for all of you.</div>
      <p>Choose a few interests for each person, or try the sample group. You’ll see where your preferences meet—and where they don’t.</p>
      <div className="empty-rule"/><p className="small-print">No booking, purchase or message is sent.</p>
    </div> : <>
      {dirty && <p className="notice">This is the previous comparison. Compare again to use the edits at left.</p>}
      {comparison.status === 'partial' && <p className="notice" role="status">Some places lack evidence for one or more people. Only fully comparable places are ranked.</p>}
      {!comparison.candidates.length ? <div className="empty-state compact"><h3>No comparable places remain.</h3><p>Restore an excluded place or change the group’s interests. Missing evidence has not been filled in.</p></div> : <>
        <div className="comparison-intro"><p>Smallest compromise first.</p><span>Each column ranks the same shortlist; chosen interests appear below each person.</span></div>
        <div className="table-scroll" tabIndex={0} aria-label="Place comparison, scroll horizontally on a narrow screen">
          <table><thead><tr><th scope="col">Meeting place</th>{members.map(m => <th scope="col" className="member-column" key={m.id}><span className="column-person"><span className={`person-dot tone-${m.id.slice(-1)}`} />{personName(m.id)}</span><span className="column-interests">{interestsFor(m).join(' · ')}</span></th>)}<th scope="col">Actions</th></tr></thead>
            <tbody>{comparison.candidates.map((place, index) => <tr key={place.id} className={`${index === 0 ? 'best-row' : ''} ${activeId === place.id ? 'selected-row' : ''}`}>
              <th scope="row"><button className="place-button" onClick={() => setSelected(place.id)} aria-pressed={activeId === place.id}><span className="place-order">{String(index + 1).padStart(2, '0')}</span><span><strong>{place.name}</strong><small>{place.kind}</small></span></button></th>
              {members.map(m => { const position = place.perMember.find(p => p.memberId === m.id); return <td key={m.id}><div className="rank-cell"><strong>#{position.rank}</strong><span className="rank-track"><span style={{ width: `${100 * (1 - position.regret)}%` }}/></span></div></td>; })}
              <td><button className="text-button exclude" disabled={disabled || dirty} onClick={() => onExclude(place.id)} aria-label={`Exclude ${place.name}`}>Exclude</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {detail && <div className="place-detail" aria-live="polite"><div className="detail-copy"><h3>{detail.name}</h3><p>{detail.note}</p>{detail.explanations?.length > 0 && <div className="explanation"><h4>Why Qloo nominated it</h4><ul>{detail.explanations.flatMap(group => group.contributions.map(contribution => <li key={`${group.memberId}-${contribution.entityId}`}><span><strong>{personName(group.memberId)}</strong> · {entityLookup.get(contribution.entityId)?.name ?? 'Confirmed interest'}</span><span className="contribution-score">{Math.round(contribution.score * 100)}% signal contribution</span></li>))}</ul><p>Contribution scores explain this nomination. They are not personal enjoyment probabilities.</p></div>}</div><div className="compromise"><strong>{detail.worstRank - 1}</strong><span>{detail.worstRank === 2 ? 'position is' : 'positions are'} the most anyone gives up from their top choice in this shortlist.</span></div></div>}
        <p className="small-print limits">Ordinal ranks are not the probability that someone will enjoy a place. Opening hours and prices have not been checked.{comparison.evidenceSource === 'snapshot' && comparison.evidenceAt && <> Fixed Qloo snapshot captured {evidenceTime(comparison.evidenceAt)}; opening it uses 0 new Qloo requests.</>}{comparison.evidenceSource === 'live' && comparison.evidenceAt && <> Live Qloo evidence fetched {evidenceTime(comparison.evidenceAt)}. Repeating this exact comparison in the current session reuses it for up to ten minutes.</>}{comparison.evidenceSource === 'fixture' && <> Fictional fixture evidence; no Qloo request was made.</>}</p>
      </>}
      {comparison.excluded.length > 0 && <section className="excluded"><h3>Excluded from this group</h3><p>These places stay out until you restore them or start over.</p><ul>{comparison.excluded.map(p => <li key={p.id}><span>{p.name}</span><button className="text-button" disabled={disabled || dirty} onClick={() => onRestore(p.id)}>Restore<span className="sr-only"> {p.name}</span></button></li>)}</ul></section>}
      {comparison.incomplete.length > 0 && <details className="method"><summary>Places with incomplete evidence ({comparison.incomplete.length})</summary><ul>{comparison.incomplete.map(p => <li key={p.id}>{p.name}: {p.reason}</li>)}</ul></details>}
      <details className="method"><summary>How the compromise is chosen</summary><p>The shortlist has at most 10 nominated places. Each person’s first nomination is kept; shared nominations fill the remaining spaces. {comparison.pool?.omittedCount > 0 ? `${comparison.pool.omittedCount} additional nominations were outside that limit. ` : ''}Excluded places stay out of the comparison.</p><p>For each person, we rank only places with evidence for everyone. We first minimize the largest drop from anyone’s top choice, then the average drop. An exact tie uses a stable venue ID. Different people’s raw affinity scores are never averaged.</p><p>{comparison.provenance}</p></details>
    </>}
  </section>;
}
