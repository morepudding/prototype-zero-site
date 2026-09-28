const { Redis } = require('@upstash/redis');

const IDS_KEY = 'prototype0:blaster:choice-ids';
const CHOICE_KEY = 'prototype0:blaster:choice:';
const VOTE_EVENTS_KEY = 'prototype0:discord:vote-events';
const VALID_STYLES = new Set(['01', '02', '03', '04', '05']);
const VALID_SOUNDS = new Set(['impulsion', 'plasma', 'charge']);
const EQUIPMENT = new Set(['shotgun', 'modulo_drone', 'javelin', 'magnetic_field', 'static_shield', 'pyro_boots', 'bio_injector', 'baroud', 'omnivamp']);
const GAME_SFX = new Set(['drone-launch', 'pyro-dash', 'javelin-teleport', 'magnetic-absorb', 'robot-destruction', 'impact-robot', 'impact-decor', 'impact-critique', 'degats-recus', 'robot-footsteps', 'bush-entry', 'bush-exit', 'bush-movement', 'enemy-shot', 'enemy-melee', 'enemy-charge-warning', 'low-health', 'baroud-activation']);
const VARIANTS = new Set(['a', 'b']);
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('Redis is not configured');
  }
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN
  });
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
      icons: Object.fromEntries([...EQUIPMENT].map(item => [item, VARIANTS.has(record[`icon:${item}`]) ? record[`icon:${item}`] : null])),
      gameSfx: Object.fromEntries([...GAME_SFX].map(item => [item, VARIANTS.has(record[`game-sfx:${item}`]) ? record[`game-sfx:${item}`] : null])),
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
      const item = body.item;
      if (!ID_PATTERN.test(id) || name.length < 1 || name.length > 24 ||
          !['style', 'sound', 'icon', 'game-sfx'].includes(kind) ||
          (kind === 'style' && !VALID_STYLES.has(value)) ||
          (kind === 'sound' && !VALID_SOUNDS.has(value)) ||
          (kind === 'icon' && (!EQUIPMENT.has(item) || !VARIANTS.has(value))) ||
          (kind === 'game-sfx' && (!GAME_SFX.has(item) || !VARIANTS.has(value)))) {
        return response.status(400).json({ error: 'Choix invalide.' });
      }

      const field = kind === 'icon' || kind === 'game-sfx' ? `${kind}:${item}` : kind;
      const previous = await redis.hget(CHOICE_KEY + id, field);
      await redis.hset(CHOICE_KEY + id, {
        name,
        [field]: value,
        updatedAt: new Date().toISOString()
      });
      await redis.sadd(IDS_KEY, id);
      if (previous !== value && process.env.DISCORD_WEBHOOK_URL) {
        try {
          await redis.rpush(VOTE_EVENTS_KEY, JSON.stringify({ id, name, kind, item: kind === 'icon' || kind === 'game-sfx' ? item : null, changed: previous !== null }));
        } catch (error) {
          console.error('Vote notification queue failed:', error);
        }
      }
    }

    return response.status(200).json({ choices: await listChoices(redis) });
  } catch (error) {
    console.error('Choice storage failed:', error);
    return response.status(503).json({ error: 'Enregistrement temporairement indisponible.' });
  }
};
