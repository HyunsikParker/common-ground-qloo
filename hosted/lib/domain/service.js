import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import { rankCommonGround } from './ranking.js';
import { entities, sampleGroup, FixtureProvider } from './fixture-provider.js';
import { candidatePool } from './candidate-pool.js';
import { publicArea } from './area.js';

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
  }
  enqueue(action) {
    const pending = this.tail.then(action); this.tail = pending.catch(() => {}); return pending;
  }
  state() {
    return { mode: this.provider.mode, provenance: this.provider.provenance, area: this.area, revision: this.revision,
      groups: this.groups, entities: [...this.confirmed.values()], comparison: this.result() };
  }
  result() {
    return this.evidence ? { ...rankCommonGround({ ...this.evidence, excluded: [...this.excluded] }), pool: this.evidence.pool, provenance: this.provider.provenance, evidenceAt: this.evidence.generatedAt ? new Date(this.evidence.generatedAt).toISOString() : null } : null;
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
  async compare(groups, area = this.area) {
    const members = validateGroups(groups, this.confirmed);
    const meetingArea = this.provider.mode === 'qloo' ? publicArea(area) : 'Example neighborhood';
    if (this.provider.mode !== 'qloo' && area !== meetingArea) throw new AppError('area_unavailable', 'The fictional sample is available only in its example neighborhood.');
    const signature=JSON.stringify({area:meetingArea,members:[...members].sort((a,b)=>a.id.localeCompare(b.id))});
    if(this.provider.mode==='qloo'&&this.evidence?.signature===signature&&Date.now()-this.evidence.generatedAt<10*60000){this.groups=members;this.revision++;return this.state();}
    const nominations = [];
    // Sequential, bounded provider calls. No burst parallelism against an event quota.
    for (const member of [...members].sort((a, b) => a.id.localeCompare(b.id))) {
      const suggestions = await this.provider.suggest(member.entityIds, meetingArea);
      nominations.push(suggestions);
    }
    const pool = candidatePool(nominations);
    const candidates = pool.candidates;
    const scores = {};
    for (const member of members) scores[member.id] = candidates.length ? await this.provider.rank(member.entityIds, candidates.map(p => p.id)) : {};
    // Commit only a fully completed provider transaction; a failed refresh never installs partial output.
    this.groups = members; this.area = meetingArea; this.evidence = { candidates, members, scores, signature, generatedAt:Date.now(), pool: { nominatedCount: pool.nominatedCount, omittedCount: pool.omittedCount, limit: pool.limit } }; this.revision++;
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
    for (const { signal, ...entity } of entities) this.confirmed.set(entity.id, entity);
    return this.compare(structuredClone(sampleGroup));
  }
  async publicExample(){
    if(this.provider.mode!=='qloo')throw new AppError('sample_unavailable','Use the fictional sample in sample mode.',409);
    const example=[
      {id:'C7EC4CA9-1CCC-4991-B738-55F075441B3F',name:'Arrival',kind:'Film',detail:'2016 film directed by Denis Villeneuve'},
      {id:'578CFC26-B696-449A-9655-3FB270DDA725',name:'Miles Davis',kind:'Artist',detail:'Jazz trumpeter and composer'},
      {id:'1B088E28-0668-4670-A97B-87865A1FCBCF',name:'Brian Eno',kind:'Artist',detail:'Musician and composer'},
    ];
    const pending=new GroupService(this.provider);
    pending.revision=this.revision;pending.confirmed=new Map(this.confirmed);pending.resolutions=new Map(this.resolutions);pending.excluded=new Set(this.excluded);pending.evidence=this.evidence;pending.area=this.area;
    for(const entity of example)pending.confirmed.set(entity.id,entity);
    await pending.compare(example.map((entity,i)=>({id:`person-${i+1}`,entityIds:[entity.id]})),this.area);
    for(const name of ['revision','confirmed','resolutions','excluded','evidence','area','groups'])this[name]=pending[name];
    return this.state();
  }
  reset() {
    this.groups = []; this.confirmed.clear(); this.resolutions.clear(); this.excluded.clear(); this.evidence = null; this.area = this.provider.area ?? 'Example neighborhood'; this.revision++;
    return this.state();
  }
}
