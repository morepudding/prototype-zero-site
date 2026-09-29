const { randomUUID, timingSafeEqual } = require('node:crypto');
const { getRedis, readSectors, OWNERS, LAST_REPORT_KEY } = require('../lib/sectors.cjs');

const LOCK_KEY = 'prototype0:sectors:report-lock';
const PAGE_URL = 'https://prototype-zero-site.vercel.app/repartition.html';

function parisDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function summarize(sectors, now = new Date()) {
  const active = sectors.filter(sector => !sector.archived);
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(now);
  const lines = [`**Répartition des secteurs — ${date}**`, ''];
  // All twenty starting sectors fit in one message. Bound larger custom boards.
  const limit = active.filter(sector => sector.owner).length <= 20 ? 20 : 8;
  for (const [id, name] of Object.entries(OWNERS)) {
    const assigned = active.filter(sector => sector.owner === id);
    lines.push(`**${id === 'both' ? 'En commun — Akomoses et morepudding' : name}**`);
    if (!assigned.length) lines.push('Aucun secteur attribué.');
    else {
      const visible = assigned.slice(0, limit);
      for (const sector of visible) lines.push(`• ${sector.title.replace(/[\r\n*_\x60~|<>@\\]/g, '').slice(0, 64)}`);
      if (assigned.length > visible.length) lines.push(`• Et ${assigned.length - visible.length} autres secteurs sur le site.`);
    }
    lines.push('');
  }
  const unassigned = active.filter(sector => !sector.owner).length;
  lines.push(`**À attribuer : ${unassigned} secteur${unassigned > 1 ? 's' : ''}.**`, PAGE_URL);
  return lines.join('\n');
}

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
    if (request.body?.preview === true) return response.status(200).json({ content: summarize(sectors, now) });
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
      body: JSON.stringify({ content: summarize(sectors, now), username: 'Spidey Bot', allowed_mentions: { parse: [] } })
    });
    if (!sent.ok) throw new Error('Discord delivery failed');
    const message = await sent.json();
    await redis.set(LAST_REPORT_KEY, { day, sentAt: now.toISOString(), messageId: message.id });
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
