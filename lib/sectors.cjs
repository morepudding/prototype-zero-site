const { Redis } = require('@upstash/redis');
const { randomUUID } = require('node:crypto');
const defaults = require('../dist/data/secteurs.json');

const BOARD_KEY = 'prototype0:sectors:v1';
const LAST_REPORT_KEY = 'prototype0:sectors:last-report';
const OWNERS = Object.freeze({ akomoses: 'Akomoses', morepudding: 'morepudding' });
const CATEGORIES = [...new Set(defaults.map(sector => sector.category)), 'Autre'];

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) throw new Error('Storage is not configured');
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

function decode(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

const INIT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('HSET', KEYS[1], '_schema', '1')
  for i = 1, #ARGV, 2 do redis.call('HSET', KEYS[1], ARGV[i], ARGV[i+1]) end
end
return 1`;

async function readSectors(redis) {
  const entries = defaults.flatMap((sector, index) => [sector.id, JSON.stringify({
    ...sector, owner: null, archived: false, order: index, version: 'initial', updatedAt: null,
    titleKey: titleKey(sector.title)
  })]);
  await redis.eval(INIT_SCRIPT, [BOARD_KEY], entries);
  const board = await redis.hgetall(BOARD_KEY);
  return Object.entries(board || {}).filter(([id]) => id !== '_schema')
    .map(([, value]) => {
      const sector = decode(value);
      return { ...sector, owner: Object.hasOwn(OWNERS, sector.owner) ? sector.owner : null, archived: sector.archived === true };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'fr'));
}

function titleKey(title) {
  return title.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
}

function validate(body) {
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (title.length < 2 || title.length > 64 || description.length > 220 ||
      !CATEGORIES.includes(body.category) || (body.owner !== null && !Object.hasOwn(OWNERS, body.owner))) {
    return null;
  }
  return { title, description, category: body.category, owner: body.owner, titleKey: titleKey(title) };
}

// Compare-and-set protects a sector from an edit made from an outdated browser.
const SAVE_SCRIPT = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
local next = cjson.decode(ARGV[3])
if ARGV[2] == 'create' then
  if current then return 'conflict' end
  if redis.call('HLEN', KEYS[1]) >= 101 then return 'limit' end
  next.order = redis.call('HLEN', KEYS[1]) - 1
else
  if not current then return 'missing' end
  local previous = cjson.decode(current)
  if previous.version ~= ARGV[2] then return 'conflict' end
  next.order = previous.order
end
local all = redis.call('HGETALL', KEYS[1])
for i = 1, #all, 2 do
  if all[i] ~= '_schema' and all[i] ~= ARGV[1] then
    local other = cjson.decode(all[i+1])
    if other.titleKey == next.titleKey then return 'duplicate' end
  end
end
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(next))
return 'saved'`;

async function saveSector(redis, body) {
  const valid = validate(body);
  if (!valid || !['create', 'update'].includes(body.action) ||
      (body.action === 'update' && (typeof body.id !== 'string' || !/^[a-z0-9-]{3,64}$/.test(body.id) ||
        typeof body.version !== 'string' || body.version.length > 64 || typeof body.archived !== 'boolean'))) {
    return 'invalid';
  }
  const id = body.action === 'create' ? randomUUID() : body.id;
  const sector = {
    ...valid, id, archived: body.action === 'create' ? false : body.archived,
    version: randomUUID(), updatedAt: new Date().toISOString()
  };
  return redis.eval(SAVE_SCRIPT, [BOARD_KEY], [id, body.action === 'create' ? 'create' : body.version, JSON.stringify(sector)]);
}

module.exports = { BOARD_KEY, LAST_REPORT_KEY, OWNERS, CATEGORIES, defaults, getRedis, readSectors, saveSector, validate };
