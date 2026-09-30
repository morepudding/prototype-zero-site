const test = require('node:test');
const assert = require('node:assert/strict');
const { shortSummary } = require('../lib/work-summary.cjs');
const { previousDay, workOfDay, summarize } = require('../lib/daily-report.cjs');
const sectors = [{ id: 'ia', title: 'Intelligence artificielle', owner: 'both' }, { id: 'interface', title: 'Interface', owner: 'morepudding' }];
const stamp = date => new Date(date).getTime();
const work = (changes = {}) => ({ id: 'task', actor: 'morepudding', title: 'Corriger les bots', summary: 'Les bots contournent les couverts. Le comportement a été vérifié.', status: 'published', sectors: ['ia'], completedAt: stamp('2026-09-30T17:00:00Z'), publishedAt: stamp('2026-09-30T18:00:00Z'), updatedAt: stamp('2026-09-30T18:00:00Z'), ...changes });

test('previous day uses Paris calendar midnight, including DST changes', () => {
  assert.equal(previousDay(new Date('2026-09-30T22:05:00Z')), '2026-09-30');
  assert.equal(previousDay(new Date('2026-12-30T22:05:00Z')), '2026-12-29');
  assert.equal(previousDay(new Date('2026-03-29T07:07:00Z')), '2026-03-28');
  assert.equal(previousDay(new Date('2026-10-25T08:07:00Z')), '2026-10-24');
});
test('reports only yesterday completions or publications, with no active/abandoned tasks or duplicates', () => {
  const list = [work(), work(), work({ id: 'active', status: 'active' }), work({ id: 'cancelled', status: 'cancelled' }), work({ id: 'today', completedAt: stamp('2026-09-30T22:01:00Z'), publishedAt: stamp('2026-09-30T22:02:00Z') }), work({ id: 'old', completedAt: stamp('2026-09-29T20:00:00Z'), publishedAt: stamp('2026-09-29T20:01:00Z') })];
  assert.deepEqual(workOfDay(list, '2026-09-30').map(w => w.id), ['task']);
});
test('publication of older local work is reported as delivery, without changing completion date', () => {
  const content = summarize(sectors, new Date('2026-10-01T07:07:00Z'), [work({ completedAt: stamp('2026-09-29T17:00:00Z') })]);
  assert.match(content, /Le travail du 30 septembre 2026/);
  assert.match(content, /\*\*Intelligence artificielle\*\*/);
  assert.match(content, /\*\*morepudding\*\*/);
  assert.match(content, /\(publication\)/);
});
test('local results are clearly unshipped and a cross-sector task appears once', () => {
  const content = summarize(sectors, new Date('2026-10-01T07:07:00Z'), [work({ status: 'local', sectors: ['ia', 'interface'] })]);
  assert.match(content, /Intelligence artificielle · Interface/);
  assert.match(content, /sur le PC, à publier/);
  assert.equal(content.match(/Les bots contournent les couverts/g).length, 1);
  assert.doesNotMatch(content, /\(publié\)/);
});
test('summaries keep at most two sentences, bounded length, and no Discord mentions or formatting', () => {
  assert.equal(shortSummary('Première phrase. Deuxième phrase. Troisième phrase.'), 'Première phrase. Deuxième phrase.');
  assert.ok(shortSummary('Une phrase ' + 'longue '.repeat(100)).length <= 260);
  assert.doesNotMatch(shortSummary('@everyone <@123> **texte**'), /@|<|>|\*/);
});
test('legacy records use status timestamp, and repeated publication is not counted as new work', () => {
  const legacy = work({ completedAt: undefined, publishedAt: undefined });
  assert.equal(workOfDay([legacy], '2026-09-30').length, 1);
  assert.equal(workOfDay([legacy], '2026-10-01').length, 0);
});
test('busy reports stay within one short Discord message with explicit overflow', () => {
  const works = Array.from({ length: 100 }, (_, i) => work({ id: `task-${i}`, summary: 'Une amélioration ' + 'utile '.repeat(50) }));
  const content = summarize(sectors, new Date('2026-10-01T07:07:00Z'), works);
  assert.ok(content.length <= 1900);
  assert.match(content, /autres modifications dans l’historique du site/);
  assert.match(content, /repartition.html#developpements/);
});
