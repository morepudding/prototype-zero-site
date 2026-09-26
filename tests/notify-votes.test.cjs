const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../api/notify-votes');

test('groups several votes into one summary and keeps the latest vote per item', () => {
  const summary = summarize([
    JSON.stringify({ id: 'one', name: 'Romain', kind: 'icon', item: 'shotgun' }),
    JSON.stringify({ id: 'one', name: 'Romain', kind: 'icon', item: 'shotgun' }),
    JSON.stringify({ id: 'one', name: 'Romain', kind: 'sound' }),
    JSON.stringify({ id: 'two', name: 'Frère', kind: 'icon', item: 'javelin' })
  ]);
  assert.match(summary, /Romain\*\* a enregistré 2 choix : Shotgun, son du Blaster/);
  assert.match(summary, /Frère\*\* a enregistré 1 choix : Javelin/);
  assert.match(summary, /choix\.html/);
});

test('removes Discord formatting and mentions from voter names', () => {
  const summary = summarize([{ id: 'one', name: '@everyone*', kind: 'icon', item: 'shotgun' }]);
  assert.doesNotMatch(summary, /@everyone/);
  assert.match(summary, /everyone/);
});

test('ignores malformed queued events', () => {
  assert.equal(summarize(['oops', '{}']), null);
});
