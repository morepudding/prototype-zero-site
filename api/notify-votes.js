const { Redis } = require('@upstash/redis');
const { timingSafeEqual, randomUUID } = require('node:crypto');

const EVENTS_KEY = 'prototype0:discord:vote-events';
const LOCK_KEY = 'prototype0:discord:vote-flush-lock';
const CHOICES_URL = 'https://prototype-zero-site.vercel.app/choix.html';
const LABELS = {
  shotgun: 'Shotgun', modulo_drone: 'Modulo Drone', javelin: 'Javelin',
  magnetic_field: 'Magnetic Field', static_shield: 'Static Shield',
  pyro_boots: 'Pyro Boots', bio_injector: 'Bio Injector',
  baroud: 'Baroud d’honneur', omnivamp: 'Omnivamp'
};

function authorized(request) {
  const secret = process.env.NOTIFICATION_CRON_SECRET;
  const supplied = String(request.headers.authorization || '').replace(/^Bearer /, '');
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function summarize(rawEvents) {
  const latest = new Map();
  for (const raw of rawEvents) {
    try {
      const event = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!event || !event.id || !event.name || !['icon', 'sound', 'style'].includes(event.kind)) continue;
      latest.set(`${event.id}:${event.kind}:${event.item || ''}`, event);
    } catch (_) { /* Ignore an invalid queued item. */ }
  }
  const byPerson = new Map();
  for (const event of latest.values()) {
    const name = String(event.name).replace(/[\r\n*_`~|<>@]/g, '').slice(0, 24) || 'Quelqu’un';
    if (!byPerson.has(name)) byPerson.set(name, []);
    byPerson.get(name).push(event.kind === 'icon' ? LABELS[event.item] || event.item : event.kind === 'sound' ? 'son du Blaster' : 'style du Blaster');
  }
  if (!byPerson.size) return null;
  const lines = [...byPerson].map(([name, items]) => `• **${name}** a enregistré ${items.length} choix : ${items.join(', ')}.`);
  const message = ['🗳️ **Nouveaux votes**'];
  for (const line of lines) {
    if ([...message, line, CHOICES_URL].join('\n').length > 1900) {
      message.push('• … et d’autres votes.');
      break;
    }
    message.push(line);
  }
  message.push(CHOICES_URL);
  return message.join('\n');
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Méthode non autorisée.' });
  if (!authorized(request)) return response.status(401).json({ error: 'Non autorisé.' });
  if (!process.env.DISCORD_WEBHOOK_URL || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return response.status(503).json({ error: 'Notifications non configurées.' });
  }

  const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const lockId = randomUUID();
  try {
    const lock = await redis.set(LOCK_KEY, lockId, { nx: true, ex: 120 });
    if (lock !== 'OK') return response.status(200).json({ sent: false, reason: 'already-running' });
    const events = await redis.lrange(EVENTS_KEY, 0, 49);
    if (!events.length) return response.status(200).json({ sent: false, reason: 'empty' });
    const content = summarize(events);
    if (content) {
      const url = new URL(process.env.DISCORD_WEBHOOK_URL);
      url.searchParams.set('wait', 'true');
      const sent = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
      });
      if (!sent.ok) throw new Error(`Discord returned ${sent.status}`);
    }
    await redis.ltrim(EVENTS_KEY, events.length, -1);
    return response.status(200).json({ sent: Boolean(content), votes: events.length });
  } catch (error) {
    console.error('Vote notification failed:', error);
    return response.status(502).json({ error: 'Envoi impossible ; nouvel essai prévu.' });
  } finally {
    await redis.eval('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end', [LOCK_KEY], [lockId]).catch(error => console.error('Notification lock cleanup failed:', error));
  }
};

module.exports.summarize = summarize;
