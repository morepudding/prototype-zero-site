const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('saves independent A/B game sounds without changing existing votes', async () => {
  const id = '12345678-1234-4123-8123-123456789abc';
  const records = new Map([[`prototype0:blaster:choice:${id}`, {
    name: 'Ben', sound: 'plasma', 'icon:shotgun': 'a', updatedAt: '2026-09-28T00:00:00.000Z'
  }]]);
  const ids = new Set([id]);
  class Redis {
    async smembers() { return [...ids]; }
    async hgetall(key) { return records.get(key) || null; }
    async hget(key, field) { return records.get(key)?.[field] ?? null; }
    async hset(key, values) { records.set(key, {...records.get(key), ...values}); }
    async sadd(_key, value) { ids.add(value); }
  }
  const source = fs.readFileSync(path.join(__dirname, '../api/choices.js'), 'utf8');
  const module = {exports: {}};
  vm.runInNewContext(source, {
    module,
    require: () => ({Redis}),
    process: {env: {KV_REST_API_URL: 'http://example.test', KV_REST_API_TOKEN: 'test'}},
    console,
    Date
  });
  const handler = module.exports;
  const request = body => ({method: 'POST', body});
  const respond = () => ({setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }});

  const first = respond();
  await handler(request({id, name: 'Ben', kind: 'game-sfx', item: 'drone-launch', value: 'a'}), first);
  assert.equal(first.code, 200);
  assert.equal(first.body.choices[0].gameSfx['drone-launch'], 'a');
  assert.equal(first.body.choices[0].sound, 'plasma');
  assert.equal(first.body.choices[0].icons.shotgun, 'a');

  const second = respond();
  await handler(request({id, name: 'Ben', kind: 'game-sfx', item: 'pyro-dash', value: 'b'}), second);
  assert.equal(second.code, 200);
  assert.equal(second.body.choices[0].gameSfx['drone-launch'], 'a');
  assert.equal(second.body.choices[0].gameSfx['pyro-dash'], 'b');

  const impacts = ['impact-robot', 'impact-decor', 'impact-critique', 'degats-recus'];
  for (const item of impacts) {
    const saved = respond();
    await handler(request({id, name: 'Ben', kind: 'game-sfx', item, value: 'a'}), saved);
    assert.equal(saved.code, 200);
    assert.equal(saved.body.choices[0].gameSfx[item], 'a');
  }
  const updated = respond();
  await handler(request({id, name: 'Ben', kind: 'game-sfx', item: 'degats-recus', value: 'b'}), updated);
  assert.equal(updated.code, 200);
  for (const item of impacts) {
    assert.equal(updated.body.choices[0].gameSfx[item], item === 'degats-recus' ? 'b' : 'a');
  }
  assert.equal(updated.body.choices[0].gameSfx['drone-launch'], 'a');
  assert.equal(updated.body.choices[0].gameSfx['pyro-dash'], 'b');
  assert.equal(updated.body.choices[0].sound, 'plasma');
  assert.equal(updated.body.choices[0].icons.shotgun, 'a');

  const nextBatch = ['robot-footsteps', 'bush-entry', 'bush-exit', 'bush-movement', 'enemy-shot', 'enemy-melee', 'enemy-charge-warning', 'low-health', 'baroud-activation'];
  for (const item of nextBatch) {
    const saved = respond();
    await handler(request({id, name: 'Ben', kind: 'game-sfx', item, value: 'b'}), saved);
    assert.equal(saved.code, 200);
    assert.equal(saved.body.choices[0].gameSfx[item], 'b');
  }
  const nextUpdate = respond();
  await handler(request({id, name: 'Ben', kind: 'game-sfx', item: 'bush-entry', value: 'a'}), nextUpdate);
  assert.equal(nextUpdate.code, 200);
  for (const item of nextBatch) {
    assert.equal(nextUpdate.body.choices[0].gameSfx[item], item === 'bush-entry' ? 'a' : 'b');
  }
  for (const item of impacts) {
    assert.equal(nextUpdate.body.choices[0].gameSfx[item], item === 'degats-recus' ? 'b' : 'a');
  }
  assert.equal(nextUpdate.body.choices[0].gameSfx['drone-launch'], 'a');
  assert.equal(nextUpdate.body.choices[0].gameSfx['pyro-dash'], 'b');
  assert.equal(nextUpdate.body.choices[0].sound, 'plasma');
  assert.equal(nextUpdate.body.choices[0].icons.shotgun, 'a');

  const invalid = respond();
  await handler(request({id, name: 'Ben', kind: 'game-sfx', item: 'shotgun', value: 'a'}), invalid);
  assert.equal(invalid.code, 400);
});
