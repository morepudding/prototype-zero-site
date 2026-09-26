const { Redis } = require('@upstash/redis');

const IDS_KEY = 'prototype0:blaster:choice-ids';
const CHOICE_KEY = 'prototype0:blaster:choice:';
const VALID_STYLES = new Set(['01', '02', '03', '04', '05']);
const VALID_SOUNDS = new Set(['impulsion', 'plasma', 'charge']);
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Redis is not configured');
  }
  return Redis.fromEnv();
}

async function listChoices(redis) {
  const ids = await redis.smembers(IDS_KEY);
  const records = await Promise.all(ids.map(id => redis.hgetall(CHOICE_KEY + id)));
  return records
    .filter(record => record && typeof record.name === 'string')
    .map(record => ({
      name: record.name,
      style: VALID_STYLES.has(record.style) ? record.style : null,
      sound: VALID_SOUNDS.has(record.sound) ? record.sound : null,
      updatedAt: record.updatedAt || null
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const redis = getRedis();
    if (request.method === 'POST') {
      const body = request.body || {};
      const id = typeof body.id === 'string' ? body.id : '';
      const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
      const kind = body.kind;
      const value = body.value;
      if (!ID_PATTERN.test(id) || name.length < 1 || name.length > 24 ||
          !['style', 'sound'].includes(kind) ||
          (kind === 'style' && !VALID_STYLES.has(value)) ||
          (kind === 'sound' && !VALID_SOUNDS.has(value))) {
        return response.status(400).json({ error: 'Choix invalide.' });
      }

      await redis.hset(CHOICE_KEY + id, {
        name,
        [kind]: value,
        updatedAt: new Date().toISOString()
      });
      await redis.sadd(IDS_KEY, id);
    }

    return response.status(200).json({ choices: await listChoices(redis) });
  } catch (error) {
    console.error('Choice storage failed:', error);
    return response.status(503).json({ error: 'Enregistrement temporairement indisponible.' });
  }
};
