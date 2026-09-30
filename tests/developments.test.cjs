const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { issueToken, tokenActor, validateClaim, publicRecord, overlaps, mutate, listDevelopments, confirmPublished, LEASE_MS } = require('../lib/developments.cjs');
const { getRedis, defaults } = require('../lib/sectors.cjs');
const body = (session = 'session-alpha') => ({ action: 'claim', session, title: 'Corriger le contournement des couverts', topic: 'ia-contournement-couverts', sectors: ['intelligence-artificielle'], files: ['scripts/training_bot.gd'] });

test('pair tokens are actor scoped, expiring, signed and revoked by edit-code rotation', () => {
  const previous = process.env.SECTORS_EDIT_CODE;
  try {
    process.env.SECTORS_EDIT_CODE = 'example-code';
    const token = issueToken('morepudding', 1000);
    assert.equal(tokenActor(token, 2000), 'morepudding');
    assert.equal(tokenActor(token.replace('morepudding', 'akomoses'), 2000), null);
    assert.equal(tokenActor(token, 1000 + 180 * 86400000), null);
    process.env.SECTORS_EDIT_CODE = 'rotated-code';
    assert.equal(tokenActor(token, 2000), null);
  } finally { if (previous === undefined) delete process.env.SECTORS_EDIT_CODE; else process.env.SECTORS_EDIT_CODE = previous; }
});
test('claims reject empty, unknown, archived, private paths and unbounded fields', () => {
  assert.ok(validateClaim(body(), defaults));
  for (const invalid of [{ title: 'x' }, { sectors: [] }, { sectors: ['not-a-sector'] }, { files: ['../secret'] }, { files: ['C:/private'] }, { session: '' }, { baseCommit: 'fake' }]) {
    assert.equal(validateClaim({ ...body(), ...invalid }, defaults), null);
  }
  assert.equal(validateClaim(body(), defaults.map(s => ({ ...s, archived: true }))), null);
});
test('public records omit credentials/session and reflect lease expiry', () => {
  const record = { id: randomUUID(), status: 'active', leaseUntil: 200, leaseToken: 'private', session: 'private', topic: 'internal', files: [] };
  const expired = publicRecord(record, 201);
  assert.equal(expired.status, 'interrupted');
  assert.equal('leaseToken' in expired || 'session' in expired || 'topic' in expired, false);
  assert.equal(publicRecord(record, 199).status, 'active');
});
test('shared files warn, but a shared sector alone does not lock it', () => {
  const first = { ...body(), id: 'first' };
  const other = { ...body('session-beta'), id: 'other', files: ['scripts/other.gd'], title: 'Ajouter un bot de duel' };
  assert.equal(overlaps(first, other), false);
  assert.equal(overlaps(first, { ...other, files: first.files }), true);
});

test('real Redis: only the originating actor and session can reopen finished work, with fresh fencing and bounded history', { skip: !process.env.COORDINATION_REDIS_TEST }, async () => {
  const redis = getRedis(), key = `prototype0:test:coordination:${randomUUID()}`;
  let now = Date.now();
  const owner = 'morepudding', original = { ...body('reopen-origin-session'), baseCommit: 'b'.repeat(40) };
  const auth = record => ({ id: record.id, leaseToken: record.leaseToken, session: record.session });
  try {
    const first = (await mutate(redis, owner, original, defaults, now++, key)).record;
    const summary = 'Les premiers sons sont vérifiés.';
    const completed = (await mutate(redis, owner, { ...auth(first), action: 'finish', summary }, [], now++, key)).record;
    assert.equal((await mutate(redis, 'akomoses', original, defaults, now++, key)).error, 'duplicate');
    assert.equal((await mutate(redis, owner, body('reopen-other-session'), defaults, now++, key)).error, 'duplicate');
    assert.equal((await mutate(redis, owner, { ...original, baseCommit: undefined }, defaults, now++, key)).error, 'invalid');

    const other = (await mutate(redis, owner, { ...original, topic: 'autre-correction', title: 'Corriger un autre outil' }, defaults, now++, key)).record;
    const busy = await mutate(redis, owner, original, defaults, now++, key);
    assert.equal(busy.error, 'session_busy');
    assert.equal(busy.conflicting, other.id);
    const unchanged = (await mutate(redis, owner, { ...auth(first), action: 'check' }, [], now++, key)).record;
    assert.equal(unchanged.status, 'local');
    assert.equal(unchanged.leaseToken, first.leaseToken);
    await mutate(redis, owner, { ...auth(other), action: 'finish' }, [], now++, key);

    const raced = await Promise.all([
      mutate(redis, owner, original, defaults, now, key),
      mutate(redis, 'akomoses', body('reopen-racer-session'), defaults, now, key)
    ]);
    now++;
    const reopened = raced[0];
    assert.equal(raced[1].error, 'duplicate');
    assert.equal(reopened.resumed, true);
    assert.equal(reopened.record.id, first.id);
    assert.equal(reopened.record.createdAt, first.createdAt);
    assert.equal(reopened.record.publicationBaseCommit, original.baseCommit);
    assert.equal(reopened.record.status, 'active');
    assert.equal(reopened.record.leaseUntil, now - 1 + LEASE_MS);
    assert.notEqual(reopened.record.leaseToken, first.leaseToken);
    assert.equal(reopened.record.completedAt, undefined);
    assert.equal(reopened.record.summary, undefined);
    assert.deepEqual(reopened.record.completionHistory, [{ completedAt: completed.completedAt, summary }]);
    for (const action of ['heartbeat', 'finish', 'cancel']) {
      assert.equal((await mutate(redis, owner, { ...auth(first), action }, [], now++, key)).error, 'ownership');
    }
    await confirmPublished(redis, [{ id: first.id, commit: 'b'.repeat(40) }], now++, key);
    assert.equal((await listDevelopments(redis, now, key)).find(r => r.id === first.id).status, 'active');
    const retried = await mutate(redis, owner, original, defaults, now++, key);
    assert.equal(retried.resumed, false);
    assert.equal(retried.record.leaseToken, reopened.record.leaseToken);
    let current = retried.record;
    for (let index = 0; index < 9; index++) {
      await mutate(redis, owner, { ...auth(current), action: 'finish', summary: `Fin numéro ${index}.` }, [], now++, key);
      current = (await mutate(redis, owner, original, defaults, now++, key)).record;
    }
    assert.equal(current.completionHistory.length, 8);
    assert.equal(current.completionHistory[0].summary, 'Fin numéro 1.');
    assert.equal(current.completionHistory.at(-1).summary, 'Fin numéro 8.');
    const publicView = publicRecord(current, now);
    assert.equal('leaseToken' in publicView || 'session' in publicView || 'topic' in publicView, false);
    assert.ok(!JSON.stringify(publicView.completionHistory).includes(current.leaseToken));
    await mutate(redis, owner, { ...auth(current), action: 'finish', summary: 'La suite est vérifiée.' }, [], now++, key);
    await confirmPublished(redis, [{ id: first.id, commit: 'a'.repeat(40) }], now++, key);
    assert.equal((await listDevelopments(redis, now, key)).find(r => r.id === first.id).status, 'local');
    await confirmPublished(redis, [{ id: first.id, commit: 'a'.repeat(40), resumedAt: reopened.record.resumedAt }], now++, key);
    assert.equal((await listDevelopments(redis, now, key)).find(r => r.id === first.id).status, 'local');
    await confirmPublished(redis, [{ id: first.id, commit: 'a'.repeat(40), resumedAt: current.resumedAt }], now++, key);
    const published = (await listDevelopments(redis, now, key)).find(r => r.id === first.id);
    assert.equal(published.status, 'published');
    const followup = await mutate(redis, owner, original, defaults, now++, key);
    assert.notEqual(followup.record.id, first.id);
    assert.equal(followup.resumed, undefined);
    assert.equal((await listDevelopments(redis, now, key)).find(r => r.id === first.id).status, 'published');
  } finally { await redis.del(key); }
});

test('real Redis: races, same-session retries, stale fencing, local work and publication', { skip: !process.env.COORDINATION_REDIS_TEST }, async () => {
  const redis = getRedis(), key = `prototype0:test:coordination:${randomUUID()}`;
  const now = Date.now();
  try {
    const results = await Promise.all([
      mutate(redis, 'morepudding', body(), defaults, now, key),
      mutate(redis, 'akomoses', body('session-beta'), defaults, now, key)
    ]);
    assert.equal(results.filter(r => r.record).length, 1);
    assert.equal(results.filter(r => r.error === 'duplicate').length, 1);
    const winner = results.find(r => r.record).record;
    const ownerBody = body(winner.session);
    const retry = await mutate(redis, winner.actor, ownerBody, defaults, now + 100, key);
    assert.equal(retry.record.id, winner.id);
    const auth = { id: winner.id, leaseToken: winner.leaseToken, session: winner.session };
    await confirmPublished(redis, [{ id: winner.id, commit: 'b'.repeat(40) }], now + 150, key);
    assert.equal((await listDevelopments(redis, now + 151, key)).find(r => r.id === winner.id).status, 'active');
    assert.equal((await mutate(redis, winner.actor, { ...auth, action: 'heartbeat', leaseToken: randomUUID() }, [], now + 200, key)).error, 'ownership');
    const unrelated = await mutate(redis, 'akomoses', { ...body('session-gamma'), title: 'Améliorer la visée du duel', topic: 'ia-visee-duel', files: ['scripts/duel_bot_state.gd'] }, defaults, now + 200, key);
    assert.ok(unrelated.record);
    assert.equal((await mutate(redis, winner.actor, { ...auth, action: 'heartbeat' }, [], now + LEASE_MS + 200, key)).error, 'expired');
    const replacement = await mutate(redis, winner.actor, ownerBody, defaults, now + LEASE_MS + 300, key);
    assert.notEqual(replacement.record.id, winner.id);
    assert.equal((await mutate(redis, winner.actor, { ...auth, action: 'finish' }, [], now + LEASE_MS + 400, key)).error, 'expired');
    const next = replacement.record;
    const finished = await mutate(redis, next.actor, { action: 'finish', id: next.id, leaseToken: next.leaseToken, session: next.session, summary: 'Les bots contournent les couverts. Le comportement a été vérifié. Cette troisième phrase sera supprimée.' }, [], now + LEASE_MS + 500, key);
    assert.equal(finished.record.completedAt, now + LEASE_MS + 500);
    assert.equal(finished.record.summary, 'Les bots contournent les couverts. Le comportement a été vérifié.');
    assert.equal((await mutate(redis, next.actor, { action: 'check', id: next.id, leaseToken: next.leaseToken, session: next.session }, [], now + 2 * LEASE_MS, key)).record.status, 'local');
    assert.equal((await mutate(redis, next.actor, { action: 'heartbeat', id: next.id, leaseToken: next.leaseToken, session: next.session }, [], now + 2 * LEASE_MS, key)).error, 'expired');
    assert.equal((await mutate(redis, 'akomoses', body('session-delta'), defaults, now + 2 * LEASE_MS, key)).error, 'duplicate');
    await confirmPublished(redis, [{ id: next.id, commit: 'a'.repeat(40) }], now + 2 * LEASE_MS + 1, key);
    const publicList = await listDevelopments(redis, now + 2 * LEASE_MS + 2, key);
    assert.equal(publicList.find(r => r.id === next.id).status, 'published');
    assert.equal(publicList.find(r => r.id === next.id).commit, 'a'.repeat(40));
    assert.equal(publicList.find(r => r.id === next.id).completedAt, now + LEASE_MS + 500);
    assert.equal(publicList.find(r => r.id === next.id).publishedAt, now + 2 * LEASE_MS + 1);
    await confirmPublished(redis, [{ id: next.id, commit: 'a'.repeat(40) }], now + 3 * LEASE_MS, key);
    assert.equal((await listDevelopments(redis, now + 3 * LEASE_MS, key)).find(r => r.id === next.id).publishedAt, now + 2 * LEASE_MS + 1);
    assert.ok(publicList.every(r => !r.leaseToken && !r.session));
    assert.ok((await mutate(redis, 'akomoses', body('session-delta'), defaults, now + 2 * LEASE_MS + 3, key)).record);
  } finally { await redis.del(key); }
});
