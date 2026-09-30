const { randomUUID, timingSafeEqual } = require('node:crypto');
const { getRedis, readSectors, LAST_REPORT_KEY } = require('../lib/sectors.cjs');
const { listDevelopments } = require('../lib/developments.cjs');
const { parisDay, previousDay, summarize } = require('../lib/daily-report.cjs');

const LOCK_KEY = 'prototype0:sectors:report-lock';

function authorized(request) {
  const secret = process.env.NOTIFICATION_CRON_SECRET;
  const supplied = String(request.headers.authorization || '').replace(/^Bearer /, '');
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Méthode non autorisée.' });
  if (!authorized(request)) return response.status(401).json({ error: 'Non autorisé.' });
  const lockId = randomUUID();
  let redis, locked = false;
  try {
    redis = getRedis();
    const now = new Date();
    const sectors = await readSectors(redis);
    const developments = await listDevelopments(redis);
    const content = summarize(sectors, now, developments);
    if (request.body?.preview === true) return response.status(200).json({ content, workDay: previousDay(now) });
    if (!process.env.SECTORS_DISCORD_WEBHOOK_URL) return response.status(503).json({ error: 'Salon de répartition non configuré.' });
    const day = parisDay(now);
    const lock = await redis.set(LOCK_KEY, lockId, { nx: true, ex: 180 });
    if (lock !== 'OK') return response.status(200).json({ sent: false, reason: 'already-running' });
    locked = true;
    const previous = await redis.get(LAST_REPORT_KEY);
    if (previous?.day === day) return response.status(200).json({ sent: false, reason: 'already-sent' });
    const url = new URL(process.env.SECTORS_DISCORD_WEBHOOK_URL);
    url.searchParams.set('wait', 'true');
    const sent = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ content, username: 'Spidey Bot', allowed_mentions: { parse: [] } })
    });
    if (!sent.ok) throw new Error('Discord delivery failed');
    const message = await sent.json();
    await redis.set(LAST_REPORT_KEY, { day, workDay: previousDay(now), sentAt: now.toISOString(), messageId: message.id });
    return response.status(200).json({ sent: true, day });
  } catch (error) {
    console.error('Sector report failed:', error.name);
    return response.status(502).json({ error: 'Envoi impossible ; un nouvel essai est prévu.' });
  } finally {
    if (locked) await redis.eval('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end', [LOCK_KEY], [lockId]).catch(() => {});
  }
};

module.exports.summarize = summarize;
module.exports.parisDay = parisDay;
