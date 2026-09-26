const test = require('node:test');
const assert = require('node:assert/strict');
const { listPushes } = require('../api/game-pushes');

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
