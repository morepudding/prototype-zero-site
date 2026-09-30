const { Redis } = require('@upstash/redis');
const { timingSafeEqual } = require('node:crypto');
const { confirmPublished } = require('../lib/developments.cjs');
const { pushes: publishedPushes } = require('../dist/data/patchs.json');

const LIST_KEY = 'prototype0:game-pushes:list';
const RECORD_KEY = 'prototype0:game-pushes:record:';
const AUTHORS = new Set(['BotteroRomain', 'aKoMoses']);
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;

function getRedis() {
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

async function listPushes(redis) {
  const ids = await redis.lrange(LIST_KEY, 0, 99);
  const records = await Promise.all(ids.map(id => redis.get(RECORD_KEY + id)));
  const illustrated = new Map(publishedPushes.map(push => [push.commit, push]));
  const recent = records.map(record => typeof record === 'string' ? JSON.parse(record) : record)
    .filter(Boolean).map(push => ({ ...push, ...illustrated.get(push.commit) }));
  const seen = new Set(recent.map(push => push.commit));
  return [...recent, ...publishedPushes.filter(push => !seen.has(push.commit))];
}

function authorized(request) {
  const secret = process.env.GAME_PUSH_SECRET;
  const supplied = String(request.headers.authorization || '').replace(/^Bearer /, '');
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validPush(push) {
  return push && COMMIT_PATTERN.test(push.commit) && AUTHORS.has(push.author) &&
    typeof push.title === 'string' && push.title.length > 0 && push.title.length <= 140 &&
    typeof push.summary === 'string' && push.summary.length > 0 && push.summary.length <= 1200 &&
    Array.isArray(push.changes) && push.changes.length <= 10 &&
    push.changes.every(change => typeof change === 'string' && change.length <= 160) &&
    typeof push.source === 'string' && push.source.startsWith('https://github.com/aKoMoses/PROTOTYPE-V0.1/') &&
    /^\d{4}-\d{2}-\d{2}$/.test(push.date) &&
    (push.workReferences === undefined || (Array.isArray(push.workReferences) && push.workReferences.length <= 100 &&
      push.workReferences.every(ref => ref && /^[a-f0-9-]{36}$/.test(ref.id) && COMMIT_PATTERN.test(ref.commit))));
}

async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ error: 'Méthode non autorisée.' });
  if (request.method === 'POST' && !authorized(request)) return response.status(401).json({ error: 'Non autorisé.' });
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return response.status(503).json({ error: 'Stockage indisponible.' });
  try {
    const redis = getRedis();
    if (request.method === 'GET') return response.status(200).json({ pushes: await listPushes(redis) });
    const push = request.body || {};
    if (!validPush(push)) return response.status(400).json({ error: 'Push invalide.' });
    const record = {
      commit: push.commit, author: push.author, date: push.date,
      title: push.title, summary: push.summary, changes: push.changes, source: push.source
    };
    const created = await redis.eval(
      'if redis.call("EXISTS", KEYS[1]) == 1 then return 0 end redis.call("SET", KEYS[1], ARGV[1]) redis.call("LPUSH", KEYS[2], ARGV[2]) redis.call("LTRIM", KEYS[2], 0, 99) return 1',
      [RECORD_KEY + record.commit, LIST_KEY], [JSON.stringify(record), record.commit]
    );
    // This endpoint is authenticated only by the GitHub main-push workflow secret.
    // Always retry confirmation, even when a previous request saved the push already.
    await confirmPublished(redis, push.workReferences || []);
    return response.status(200).json({ created: created === 1, commit: record.commit });
  } catch (error) {
    console.error('Game push storage failed:', error);
    return response.status(503).json({ error: 'Enregistrement temporairement indisponible.' });
  }
}

module.exports = handler;
module.exports.listPushes = listPushes;
