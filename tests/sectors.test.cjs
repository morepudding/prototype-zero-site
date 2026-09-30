const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const { defaults, validate, readSectors } = require('../lib/sectors.cjs');
const { canEdit, sameOrigin } = require('../api/sectors');
const { summarize, parisDay } = require('../api/notify-sectors');

test('catalog covers the existing game without assigning responsibility', () => {
  assert.equal(defaults.length, 20);
  assert.equal(new Set(defaults.map(sector => sector.id)).size, defaults.length);
  for (const id of ['mode-survie', 'multijoueur', 'intelligence-artificielle', 'sorts-modules', 'effets-sonores', 'musique']) {
    assert.ok(defaults.some(sector => sector.id === id));
  }
  for (const sector of defaults) assert.equal(Object.hasOwn(sector, 'owner'), false);
});

test('accepts either owner, shared ownership or an unassigned sector and bounded content', () => {
  const body = { title: '  Nouvelle   map  ', description: '', category: 'Gameplay', owner: null };
  assert.equal(validate(body).title, 'Nouvelle map');
  assert.equal(validate({ ...body, owner: 'akomoses' }).owner, 'akomoses');
  assert.equal(validate({ ...body, owner: 'morepudding' }).owner, 'morepudding');
  assert.equal(validate({ ...body, owner: 'both' }).owner, 'both');
  for (const invalid of [{ owner: 'visitor' }, { owner: undefined }, { title: 'x' }, { title: 'a'.repeat(65) }, { description: 'a'.repeat(221) }, { category: 'unknown' }]) {
    assert.equal(validate({ ...body, ...invalid }), null);
  }
  assert.equal(validate({ ...body, title: 'ÉQUILIBRAGE' }).titleKey, 'equilibrage');
});

test('unassigned sectors remain editable when storage omits a null owner', async () => {
  const redis = { async eval() {}, async hgetall() { return { custom: { id: 'custom', title: 'Nouveau secteur', archived: false, order: 20 } }; } };
  const sectors = await readSectors(redis);
  assert.equal(sectors[0].owner, null);
  assert.ok(validate({ ...sectors[0], description: '', category: 'Autre' }));
});

test('rejects cross-site writes and checks exact host, including preview hosts', () => {
  assert.ok(sameOrigin({ headers: { host: 'prototype-zero-site.vercel.app', origin: 'https://prototype-zero-site.vercel.app' } }));
  assert.ok(sameOrigin({ headers: { host: 'localhost:4187', origin: 'http://localhost:4187' } }));
  assert.equal(sameOrigin({ headers: { host: 'prototype-zero-site.vercel.app', origin: 'https://example.test' } }), false);
  assert.equal(sameOrigin({ headers: { host: 'prototype-zero-site.vercel.app' } }), false);
});

test('editing cookie rejects expired, modified and unsigned sessions', () => {
  const oldCode = process.env.SECTORS_EDIT_CODE;
  process.env.SECTORS_EDIT_CODE = 'test-code';
  try {
    const request = (expires, signatureChange = '') => {
      const payload = `${expires}.${randomUUID()}`;
      const signature = createHmac('sha256', 'test-code').update(payload).digest('hex');
      return { headers: { cookie: `other=value; prototype0_sectors=${payload}.${signatureChange || signature}` } };
    };
    assert.ok(canEdit(request(Date.now() + 10000)));
    process.env.SECTORS_EDIT_CODE = 'test-code\r\n';
    assert.ok(canEdit(request(Date.now() + 10000)));
    assert.equal(canEdit(request(Date.now() - 1)), false);
    assert.equal(canEdit(request(Date.now() + 10000, '0'.repeat(64))), false);
    assert.equal(canEdit({ headers: { cookie: 'prototype0_sectors=administrator' } }), false);
    process.env.SECTORS_EDIT_CODE = '\r\n';
    assert.equal(canEdit(request(Date.now() + 10000)), false);
    delete process.env.SECTORS_EDIT_CODE;
    assert.equal(canEdit(request(Date.now() + 10000)), false);
  } finally {
    if (oldCode === undefined) delete process.env.SECTORS_EDIT_CODE;
    else process.env.SECTORS_EDIT_CODE = oldCode;
  }
});

test('daily report keeps responsibility counts separate from yesterday work and excludes archived sectors', () => {
  const sectors = [
    { title: 'Sorts', owner: 'akomoses', archived: false },
    { title: 'Interface', owner: 'morepudding', archived: false },
    { title: 'IA', owner: 'both', archived: false },
    { title: 'Ancien secteur', owner: 'morepudding', archived: true },
    { title: 'Musique', owner: null, archived: false }
  ];
  const content = summarize(sectors, new Date('2026-09-29T07:07:00Z'));
  assert.match(content, /Responsabilités : Akomoses 2 · morepudding 2 · 1 en commun · 1 à attribuer/);
  assert.match(content, /Aucun travail déclaré comme terminé ou publié hier/);
  assert.doesNotMatch(content, /Ancien secteur|• Sorts|• Interface/);
  assert.match(content, /repartition\.html/);
});

test('empty and large reports remain useful and within Discord message length', () => {
  assert.match(summarize([]), /Aucun travail déclaré comme terminé ou publié hier/);
  const sectors = Array.from({ length: 100 }, (_, index) => ({ title: '@everyone*' + 'a'.repeat(54), owner: ['akomoses', 'morepudding', 'both'][index % 3], archived: false }));
  const content = summarize(sectors);
  assert.ok(content.length <= 2000);
  assert.doesNotMatch(content, /@everyone/);
  assert.match(content, /33 en commun/);
});

test('initial proposal assigns every sector and the entire proposal fits in one Discord message', () => {
  const proposal = require('../dist/data/repartition-proposee.json');
  assert.equal(proposal.sectors.length, defaults.length);
  assert.equal(new Set(proposal.sectors.map(sector => sector.id)).size, defaults.length);
  const sectors = defaults.map(sector => {
    const suggestion = proposal.sectors.find(item => item.id === sector.id);
    assert.ok(suggestion?.commits.length);
    assert.ok(validate({ ...sector, owner: suggestion.owner }));
    return { ...sector, owner: suggestion.owner, archived: false };
  });
  const content = summarize(sectors);
  assert.match(content, /Akomoses 16 · morepudding 14 · 10 en commun/);
  assert.ok(content.length <= 2000);
  assert.doesNotMatch(content, /à attribuer/);
});

test('daily duplicate key follows Paris midnight across summer and winter time', () => {
  assert.equal(parisDay(new Date('2026-09-29T22:30:00Z')), '2026-09-30');
  assert.equal(parisDay(new Date('2026-12-29T23:30:00Z')), '2026-12-30');
});
