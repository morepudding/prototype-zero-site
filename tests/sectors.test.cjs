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

test('accepts only the two owners or an unassigned sector and bounded content', () => {
  const body = { title: '  Nouvelle   map  ', description: '', category: 'Gameplay', owner: null };
  assert.equal(validate(body).title, 'Nouvelle map');
  assert.equal(validate({ ...body, owner: 'akomoses' }).owner, 'akomoses');
  assert.equal(validate({ ...body, owner: 'morepudding' }).owner, 'morepudding');
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
    assert.equal(canEdit(request(Date.now() - 1)), false);
    assert.equal(canEdit(request(Date.now() + 10000, '0'.repeat(64))), false);
    assert.equal(canEdit({ headers: { cookie: 'prototype0_sectors=administrator' } }), false);
    delete process.env.SECTORS_EDIT_CODE;
    assert.equal(canEdit(request(Date.now() + 10000)), false);
  } finally {
    if (oldCode === undefined) delete process.env.SECTORS_EDIT_CODE;
    else process.env.SECTORS_EDIT_CODE = oldCode;
  }
});

test('daily report distinguishes ownership from tasks and excludes archived sectors', () => {
  const sectors = [
    { title: 'Sorts', owner: 'akomoses', archived: false },
    { title: 'Interface', owner: 'morepudding', archived: false },
    { title: 'Ancien secteur', owner: 'morepudding', archived: true },
    { title: 'Musique', owner: null, archived: false }
  ];
  const content = summarize(sectors, new Date('2026-09-29T07:07:00Z'));
  assert.match(content, /\*\*Akomoses\*\*\n• Sorts/);
  assert.match(content, /\*\*morepudding\*\*\n• Interface/);
  assert.match(content, /À attribuer : 1 secteur/);
  assert.doesNotMatch(content, /Ancien secteur|en cours|Terminé/);
  assert.match(content, /repartition\.html/);
});

test('empty and large reports remain useful and within Discord message length', () => {
  assert.match(summarize([]), /Aucun secteur attribué/);
  const sectors = Array.from({ length: 100 }, (_, index) => ({ title: '@everyone*' + 'a'.repeat(54), owner: index % 2 ? 'akomoses' : 'morepudding', archived: false }));
  const content = summarize(sectors);
  assert.ok(content.length <= 2000);
  assert.doesNotMatch(content, /@everyone/);
  assert.match(content, /40 autres secteurs/);
});

test('daily duplicate key follows Paris midnight across summer and winter time', () => {
  assert.equal(parisDay(new Date('2026-09-29T22:30:00Z')), '2026-09-30');
  assert.equal(parisDay(new Date('2026-12-29T23:30:00Z')), '2026-12-30');
});
