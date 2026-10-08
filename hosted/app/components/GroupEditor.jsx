import React, { useState } from 'react';

export const personName = id => `Person ${id.split('-')[1]}`;

function InterestSearch({ member, request, onPick, disabled }) {
  const [query, setQuery] = useState('');
  const [resolution, setResolution] = useState(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  async function search(event) {
    event.preventDefault(); setSearching(true); setMessage(''); setResolution(null);
    try {
      const result = await request('resolve', { query }); setResolution(result);
      if (!result.choices.length) setMessage('No matching work. Try another title or artist.');
    } catch (error) { setMessage(error.message); }
    finally { setSearching(false); }
  }
  async function choose(entityId) {
    setSearching(true); setMessage('');
    try {
      const result = await request('confirm', { resolutionId: resolution.resolutionId, entityId });
      onPick(member.id, result.entity, result.revision); setResolution(null); setQuery('');
    } catch (error) { setMessage(error.message); }
    finally { setSearching(false); }
  }
  return <div className="interest-search">
    <form onSubmit={search} className="search-form">
      <label className="sr-only" htmlFor={`${member.id}-search`}>Find an interest for {personName(member.id)}</label>
      <input id={`${member.id}-search`} value={query} onChange={e => { setQuery(e.target.value); setResolution(null); }} placeholder="Book, film or artist" minLength={2} maxLength={100} disabled={disabled || searching} autoComplete="off" />
      <button type="submit" className="button small secondary" disabled={disabled || searching || query.trim().length < 2}>{searching ? 'Searching…' : 'Find matches'}</button>
    </form>
    {message && <p className="field-message" role="status">{message}</p>}
    {resolution?.choices.length > 0 && <div className="choices" aria-label={`Choose a match for ${personName(member.id)}`}>
      <p>Choose the exact match</p>
      {resolution.choices.map(entity => <button type="button" key={entity.id} onClick={() => choose(entity.id)} disabled={disabled || searching || member.entityIds.includes(entity.id)}>
        <strong>{entity.name}</strong><span>{entity.kind} · {entity.detail}</span>
      </button>)}
    </div>}
  </div>;
}

export function GroupEditor({ members, entities, request, onPick, onChange, disabled, compare, dirty, area, mode, onAreaChange, venueType, venueTypes, onVenueTypeChange }) {
  const lookup = new Map(entities.map(e => [e.id, e]));
  function add() {
    const id = Array.from({ length: 6 }, (_, i) => `person-${i + 1}`).find(id => !members.some(m => m.id === id));
    onChange([...members, { id, entityIds: [] }]);
  }
  return <section className="group-editor" aria-labelledby="group-title">
    <div className="section-heading"><h2 id="group-title">1. Build your group</h2><span>{members.length} people</span></div>
    <p className="section-note">One to four interests each. No names or accounts needed.</p>
    <div className="meeting-settings">
      <div className="meeting-area">
        <label htmlFor="meeting-area">Meeting area</label>
        <input id="meeting-area" value={area} onChange={e => onAreaChange(e.target.value)} maxLength={100} autoComplete="off" disabled={disabled || mode !== 'qloo'} aria-describedby="area-help" />
        <p id="area-help" className="field-message">{mode === 'qloo' ? 'Use a public city or neighborhood. Do not enter a personal address.' : 'Fictional venues are available only in this example neighborhood.'}</p>
      </div>
      <div className="venue-type">
        <label htmlFor="venue-type">Place type</label>
        <select id="venue-type" value={venueType} onChange={e => onVenueTypeChange(e.target.value)} disabled={disabled || mode !== 'qloo'} aria-describedby="venue-type-help">
          {venueTypes.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>
        <p id="venue-type-help" className="field-message">{mode === 'qloo' ? 'Qloo will filter the shortlist to this category.' : 'The fictional sample uses cafe-like venues.'}</p>
      </div>
    </div>
    <div className="members">
      {members.map(member => <article className="member" key={member.id}>
        <div className="member-heading"><h3><span className={`person-dot tone-${member.id.slice(-1)}`} />{personName(member.id)}</h3>
          <button type="button" className="text-button" onClick={() => onChange(members.filter(m => m.id !== member.id))} disabled={disabled || members.length <= 2} aria-label={`Remove ${personName(member.id)}`}>Remove</button></div>
        {member.entityIds.length > 0 && <ul className="selected-interests">{member.entityIds.map(id => <li key={id}>
          <div><strong>{lookup.get(id)?.name ?? 'Confirmed interest'}</strong><span>{lookup.get(id)?.kind}</span></div>
          <button type="button" className="remove-interest" aria-label={`Remove ${lookup.get(id)?.name ?? 'interest'} from ${personName(member.id)}`} onClick={() => onChange(members.map(m => m.id === member.id ? { ...m, entityIds: m.entityIds.filter(x => x !== id) } : m))} disabled={disabled}>Remove</button>
        </li>)}</ul>}
        {member.entityIds.length < 4 && <InterestSearch member={member} request={request} onPick={onPick} disabled={disabled} />}
      </article>)}
    </div>
    <button type="button" className="button secondary add-person" onClick={add} disabled={disabled || members.length >= 6}>Add person</button>
    <button type="button" className="button primary compare" onClick={compare} disabled={disabled || area.trim().length < 2 || members.some(m => !m.entityIds.length)}>{disabled ? 'Working…' : 'Find common ground'}</button>
    {dirty && <p className="field-message">Interests, area or place type changed. Compare again to update the shortlist.</p>}
  </section>;
}
