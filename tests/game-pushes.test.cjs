const test = require('node:test');
const assert = require('node:assert/strict');
const { listPushes, validPush } = require('../api/game-pushes');

test('shows new game pushes before illustrated entries', async () => {
  const commit = 'a'.repeat(40);
  const redis = {
    lrange: async () => [commit],
    get: async () => JSON.stringify({ commit, author: 'BotteroRomain', title: 'Nouvelle arène' })
  };
  const pushes = await listPushes(redis);
  assert.equal(pushes[0].commit, commit);
  assert.equal(pushes[1].commit, '46fca8d99b1011aa6e62114d0a4b49fb67013c6e');
});

test('publication cycles accept valid resume timestamps and preserve legacy references', () => {
  const ref = { id: 'bdcf58da-7c52-4f4d-ab8e-e19a6701e3a7', commit: 'a'.repeat(40) };
  const push = { commit: ref.commit, author: 'BotteroRomain', title: 'Resume work', summary: 'Work verified.',
    changes: [], source: 'https://github.com/aKoMoses/PROTOTYPE-V0.1/commit/' + ref.commit, date: '2026-09-30' };
  assert.equal(validPush({ ...push, workReferences: [ref] }), true);
  assert.equal(validPush({ ...push, workReferences: [{ ...ref, resumedAt: 1780000000000 }] }), true);
  for (const resumedAt of ['1780000000000', 0, -1, 1.5, Infinity, null]) {
    assert.equal(validPush({ ...push, workReferences: [{ ...ref, resumedAt }] }), false);
  }
});
