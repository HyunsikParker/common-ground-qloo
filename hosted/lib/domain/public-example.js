export const PUBLIC_EXAMPLE_ENTITIES = Object.freeze([
  Object.freeze({ id: 'C7EC4CA9-1CCC-4991-B738-55F075441B3F', name: 'Arrival', kind: 'Film', detail: '2016 film directed by Denis Villeneuve' }),
  Object.freeze({ id: '578CFC26-B696-449A-9655-3FB270DDA725', name: 'Miles Davis', kind: 'Artist', detail: 'Jazz trumpeter and composer' }),
  Object.freeze({ id: '1B088E28-0668-4670-A97B-87865A1FCBCF', name: 'Brian Eno', kind: 'Artist', detail: 'Musician and composer' }),
]);

export const PUBLIC_EXAMPLE_GROUPS = Object.freeze(PUBLIC_EXAMPLE_ENTITIES.map((entity, index) => Object.freeze({ id: `person-${index + 1}`, entityIds: Object.freeze([entity.id]) })));

// Captured once with six Qloo requests. Per-member scores are ordinalized, so
// the snapshot preserves ranks and ties without storing raw affinity values.
export const PUBLIC_EXAMPLE_SNAPSHOT = {
  version: 1,
  capturedAt: '2026-10-08T14:59:08.902Z',
  area: 'Manhattan, New York',
  venueType: 'cafe',
  entities: [
    { id: 'C7EC4CA9-1CCC-4991-B738-55F075441B3F', name: 'Arrival', kind: 'Film', detail: '2016 film directed by Denis Villeneuve' },
    { id: '578CFC26-B696-449A-9655-3FB270DDA725', name: 'Miles Davis', kind: 'Artist', detail: 'Jazz trumpeter and composer' },
    { id: '1B088E28-0668-4670-A97B-87865A1FCBCF', name: 'Brian Eno', kind: 'Artist', detail: 'Musician and composer' },
  ],
  groups: [
    { id: 'person-1', entityIds: ['C7EC4CA9-1CCC-4991-B738-55F075441B3F'] },
    { id: 'person-2', entityIds: ['578CFC26-B696-449A-9655-3FB270DDA725'] },
    { id: 'person-3', entityIds: ['1B088E28-0668-4670-A97B-87865A1FCBCF'] },
  ],
  evidence: {
    candidates: [
      { id: '11326D51-2BE6-4596-B923-50D7079D3A32', name: 'Starbucks Coffee Company', kind: 'Cafe', note: 'Seattle-based chain serving signature coffee roasts, light bites and free WiFi in a casual grab-and-go setting.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-1', contributions: [{ entityId: 'C7EC4CA9-1CCC-4991-B738-55F075441B3F', score: 1 }] }] },
      { id: '17670207-310A-4176-9A20-387AF21AC5EB', name: 'NowHere', kind: 'Cafe', note: 'Contemporary art gallery and café in East Tribeca combining rotating exhibitions with a reimagined casual dining and coffee program.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-3', contributions: [{ entityId: '1B088E28-0668-4670-A97B-87865A1FCBCF', score: 1 }] }] },
      { id: '28C8AACC-CF37-434E-BB23-04910055349A', name: "The People's Forum", kind: 'Cafe', note: 'Community-centered nonprofit hosting political events, workshops, a bookstore, and public programs in Midtown Manhattan.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-2', contributions: [{ entityId: '578CFC26-B696-449A-9655-3FB270DDA725', score: 1 }] }] },
      { id: '466ACE15-E21F-4A3E-92BB-471B04B924EF', name: 'Cafe Amrita', kind: 'Cafe', note: 'Relaxed neighborhood cafe offering coffee, bagels, pastries, panini, salads and cocktails with sidewalk seating.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-2', contributions: [{ entityId: '578CFC26-B696-449A-9655-3FB270DDA725', score: 1 }] }] },
      { id: '6C4371C6-8C60-4E68-9067-1BB4DE417DA4', name: 'Baker Falls', kind: 'Cafe', note: 'East Village live-music bar and restaurant serving comfort food, cocktails, coffee and late-night bites in a community-focused venue.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-2', contributions: [{ entityId: '578CFC26-B696-449A-9655-3FB270DDA725', score: 1 }] }] },
      { id: '7EFA9864-5A21-477D-A956-904A066D0A4F', name: 'American Wing Cafe', kind: 'Cafe', note: 'Museum cafe inside The Metropolitan Museum of Art serving coffee, pastries, pizza, salads, and beer and wine for quick casual dining.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-1', contributions: [{ entityId: 'C7EC4CA9-1CCC-4991-B738-55F075441B3F', score: 1 }] }, { memberId: 'person-3', contributions: [{ entityId: '1B088E28-0668-4670-A97B-87865A1FCBCF', score: 1 }] }] },
      { id: '835F1907-ED65-458F-94B2-186393F80445', name: 'Silvana', kind: 'Cafe', note: 'Hip cafe-bar serving Middle Eastern small plates, shawarma and falafel, cocktails, and live music in a Bohemian setting.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-2', contributions: [{ entityId: '578CFC26-B696-449A-9655-3FB270DDA725', score: 1 }] }] },
      { id: '8AE5ABBF-9E50-4201-A7B9-A464995B2D34', name: 'Angelika Film Center & Cafe - New York', kind: 'Cafe', note: 'Independent cinema showcasing new indie and foreign films on five screens, featuring an on-site cafe serving food and drinks.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-3', contributions: [{ entityId: '1B088E28-0668-4670-A97B-87865A1FCBCF', score: 1 }] }] },
      { id: 'B70136A3-74DA-4EF8-AE40-4477090EC070', name: 'Starbucks Coffee Company', kind: 'Cafe', note: 'Seattle-origin coffeehouse chain serving signature roasts, light bites, and Wi-Fi in a casual cafe setting.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-1', contributions: [{ entityId: 'C7EC4CA9-1CCC-4991-B738-55F075441B3F', score: 1 }] }] },
      { id: 'E9FEE923-FA3A-4434-B8BA-7D2398F046B0', name: 'Flatiron Green Cafe', kind: 'Cafe', note: 'Earth-friendly food stand with outdoor tables serving health-conscious organic light fare, coffee, beer, wine, and quick bites.', area: 'Manhattan, New York', openingHours: null, price: null, explanations: [{ memberId: 'person-1', contributions: [{ entityId: 'C7EC4CA9-1CCC-4991-B738-55F075441B3F', score: 1 }] }] },
    ],
    scores: {
      'person-1': { '11326D51-2BE6-4596-B923-50D7079D3A32': 7, '17670207-310A-4176-9A20-387AF21AC5EB': 2, '28C8AACC-CF37-434E-BB23-04910055349A': 4, '466ACE15-E21F-4A3E-92BB-471B04B924EF': 3, '6C4371C6-8C60-4E68-9067-1BB4DE417DA4': 6, '7EFA9864-5A21-477D-A956-904A066D0A4F': 9, '835F1907-ED65-458F-94B2-186393F80445': 1, '8AE5ABBF-9E50-4201-A7B9-A464995B2D34': 5, 'B70136A3-74DA-4EF8-AE40-4477090EC070': 8, 'E9FEE923-FA3A-4434-B8BA-7D2398F046B0': 10 },
      'person-2': { '11326D51-2BE6-4596-B923-50D7079D3A32': 2, '17670207-310A-4176-9A20-387AF21AC5EB': 3, '28C8AACC-CF37-434E-BB23-04910055349A': 7, '466ACE15-E21F-4A3E-92BB-471B04B924EF': 8, '6C4371C6-8C60-4E68-9067-1BB4DE417DA4': 10, '7EFA9864-5A21-477D-A956-904A066D0A4F': 6, '835F1907-ED65-458F-94B2-186393F80445': 9, '8AE5ABBF-9E50-4201-A7B9-A464995B2D34': 5, 'B70136A3-74DA-4EF8-AE40-4477090EC070': 1, 'E9FEE923-FA3A-4434-B8BA-7D2398F046B0': 4 },
      'person-3': { '11326D51-2BE6-4596-B923-50D7079D3A32': 1, '17670207-310A-4176-9A20-387AF21AC5EB': 9, '28C8AACC-CF37-434E-BB23-04910055349A': 7, '466ACE15-E21F-4A3E-92BB-471B04B924EF': 4, '6C4371C6-8C60-4E68-9067-1BB4DE417DA4': 6, '7EFA9864-5A21-477D-A956-904A066D0A4F': 8, '835F1907-ED65-458F-94B2-186393F80445': 3, '8AE5ABBF-9E50-4201-A7B9-A464995B2D34': 10, 'B70136A3-74DA-4EF8-AE40-4477090EC070': 2, 'E9FEE923-FA3A-4434-B8BA-7D2398F046B0': 5 },
    },
    pool: { nominatedCount: 11, omittedCount: 1, limit: 10 },
  },
};
