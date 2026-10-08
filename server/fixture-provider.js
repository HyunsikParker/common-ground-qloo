import { AppError } from './errors.js';

export const entities = [
  { id: 'fixture:arrival-film', name: 'Arrival', kind: 'Film', detail: '2016 · science fiction', signal: [5, 2, 1, 3, 0, 4] },
  { id: 'fixture:arrival-book', name: 'Arrival', kind: 'Book', detail: 'Ted Chiang · 2016 film tie-in edition', signal: [1, 5, 3, 0, 4, 2] },
  { id: 'fixture:left-hand', name: 'The Left Hand of Darkness', kind: 'Book', detail: 'Ursula K. Le Guin · 1969', signal: [4, 1, 2, 5, 0, 3] },
  { id: 'fixture:miles-davis', name: 'Miles Davis', kind: 'Artist', detail: 'Jazz · public cultural entity', signal: [2, 5, 4, 1, 3, 0] },
  { id: 'fixture:braiding', name: 'Braiding Sweetgrass', kind: 'Book', detail: 'Robin Wall Kimmerer · 2013', signal: [1, 2, 5, 4, 3, 0] },
  { id: 'fixture:spirited', name: 'Spirited Away', kind: 'Film', detail: '2001 · animation', signal: [2, 3, 5, 1, 4, 0] },
  { id: 'fixture:brian-eno', name: 'Brian Eno', kind: 'Artist', detail: 'Ambient music · public cultural entity', signal: [3, 1, 4, 5, 2, 0] },
  { id: 'fixture:grand-budapest', name: 'The Grand Budapest Hotel', kind: 'Film', detail: '2014 · comedy-drama', signal: [4, 2, 1, 3, 5, 0] },
];

export const venues = [
  { id: 'fixture:01', name: 'The Reading Room', kind: 'Book café', note: 'A fictional café with long shared tables and a wall of books.' },
  { id: 'fixture:02', name: 'Blue Hour', kind: 'Listening café', note: 'A fictional listening room with records and small tables.' },
  { id: 'fixture:03', name: 'The Glasshouse', kind: 'Garden café', note: 'A fictional plant-filled courtyard with space for a group.' },
  { id: 'fixture:04', name: 'North Window', kind: 'Gallery café', note: 'A fictional gallery with a quiet café next door.' },
  { id: 'fixture:05', name: 'Paper Lantern', kind: 'Tea room', note: 'A fictional tea room with a small art-book collection.' },
  { id: 'fixture:06', name: 'Corner Table', kind: 'Neighborhood café', note: 'A fictional everyday café near the example meeting area.' },
].map(v => ({ ...v, area: 'Example neighborhood', openingHours: null, price: null }));

export const sampleGroup = [
  { id: 'person-1', entityIds: ['fixture:arrival-film', 'fixture:left-hand'] },
  { id: 'person-2', entityIds: ['fixture:miles-davis', 'fixture:braiding'] },
  { id: 'person-3', entityIds: ['fixture:spirited', 'fixture:brian-eno'] },
];

export class FixtureProvider {
  mode = 'fixture';
  provenance = 'Synthetic fixture evidence. Venues and affinity values are invented; no Qloo request was made.';
  async search(query) {
    const q = query.toLowerCase();
    return entities.filter(e => `${e.name} ${e.detail} ${e.kind}`.toLowerCase().includes(q)).map(e => ({ id: e.id, name: e.name, kind: e.kind, detail: e.detail }));
  }
  async suggest(entityIds) {
    const scores = await this.rank(entityIds, venues.map(v => v.id));
    return [...venues].sort((a, b) => scores[b.id] - scores[a.id] || a.id.localeCompare(b.id)).slice(0, 4);
  }
  async rank(entityIds, candidateIds) {
    const chosen = entityIds.map(id => entities.find(e => e.id === id));
    if (chosen.some(e => !e)) throw new AppError('unconfirmed_entity', 'Choose a cultural interest from the search results.');
    return Object.fromEntries(candidateIds.map(id => {
      const index = venues.findIndex(v => v.id === id);
      if (index < 0) throw new AppError('unknown_candidate', 'The requested venue is not in this comparison.');
      return [id, chosen.reduce((n, e) => n + e.signal[index], 0) / chosen.length];
    }));
  }
}
