"use client";
import React, { useEffect, useState } from 'react';
import { GroupEditor } from './GroupEditor.jsx';
import { Comparison } from './Comparison.jsx';

const emptyGroup = () => [1, 2, 3].map(n => ({ id: `person-${n}`, entityIds: [] }));
export function App() {
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState(emptyGroup);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [area, setArea] = useState('');
  async function load() {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/session'); const state = await response.json();
      if (!response.ok) throw new Error(state.error?.message ?? 'The group could not be loaded.');
      accept(state);
    } catch (e) { setError({ message: e.message, code: 'stale_session' }); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  function accept(state) {
    setSession(state); setMembers(state.groups.length ? state.groups : emptyGroup()); setArea(state.area); setDirty(false);
  }
  async function request(action, fields = {}) {
    const response = await fetch(`/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...fields, revision: session.revision }) });
    const data = await response.json();
    if (!response.ok) { const e = new Error(data.error.message); e.code = data.error.code; throw e; }
    return data;
  }
  async function act(action, fields) {
    setBusy(true); setError(null);
    try { accept(await request(action, fields)); }
    catch (e) { setError({ message: e.message, code: e.code }); }
    finally { setBusy(false); }
  }
  function pick(memberId, entity, revision) {
    setSession(s => ({ ...s, revision, entities: [...s.entities.filter(e => e.id !== entity.id), entity] }));
    setMembers(current => current.map(m => m.id === memberId ? { ...m, entityIds: [...m.entityIds, entity.id] } : m));
    setDirty(true);
  }
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="/">Common Ground</a><button type="button" className="text-button" disabled={busy || !session} onClick={() => act('reset')}>Start over</button></header>
    <main>
      <section className="intro"><div><h1>Find a place<br className="desktop-break"/> together.</h1><p>Keep each person’s interests in the conversation.</p></div>{session && <div>{session.mode==='fixture'?<button type="button" className="button sample" disabled={busy} onClick={() => act('sample')}>Try the sample group</button>:<><button type="button" className="button sample" disabled={busy} onClick={() => act('example')}>Try a public example</button><p className="example-note">Arrival (2016), Miles Davis, Brian Eno.<br/>Example interests, not your preferences.</p></>}</div>}</section>
      {session && <div className="provenance" role="status"><span className="status-dot"/>{session.mode === 'qloo' ? session.provenance : 'Sample mode — fictional venues, no Qloo request.'}</div>}
      {error && <div className="error" role="alert"><p>{error.message}</p>{error.code === 'stale_session' && <button className="button small secondary" onClick={load}>Reload group</button>}</div>}
      {!session ? <p className="loading">{busy ? 'Opening your group…' : 'The group is unavailable. Reload to try again.'}</p> : <div className="workspace">
        <GroupEditor members={members} entities={session.entities} request={request} onPick={pick} onChange={items => { setMembers(items); setDirty(true); }} disabled={busy} dirty={dirty} area={area} mode={session.mode} onAreaChange={value => { setArea(value); setDirty(true); }} compare={() => act('compare', { groups: members, area })}/>
        <Comparison comparison={session.comparison} members={session.groups} onExclude={id => act('exclude', { id })} onRestore={id => act('restore', { id })} disabled={busy} dirty={dirty}/>
      </div>}
    </main>
    <footer><span>Common Ground</span><p>A group choice tool. Not a booking service.</p><span>{session?.mode === 'qloo' ? 'Public cultural signals · no personal identifiers sent to Qloo' : 'Local fictional example'}</span></footer>
  </div>;
}
