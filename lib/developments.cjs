const { randomUUID, createHmac, timingSafeEqual } = require('node:crypto');
const KEY = 'prototype0:developments:v1';
const LEASE_MS = 45 * 60 * 1000;
const ACTORS = ['akomoses', 'morepudding'];
const UUID = /^[a-f0-9-]{36}$/;
const clean = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const equal = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
function sign(value) {
  return createHmac('sha256', String(process.env.SECTORS_EDIT_CODE || '').trim()).update(`coordination:${value}`).digest('hex');
}
function issueToken(actor, now = Date.now()) {
  const value = `${actor}.${now + 180 * 86400000}.${randomUUID()}`;
  return `${value}.${sign(value)}`;
}
function tokenActor(token, now = Date.now()) {
  const match = /^(akomoses|morepudding)\.(\d+)\.([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(String(token || ''));
  return process.env.SECTORS_EDIT_CODE?.trim() && match && Number(match[2]) > now &&
    equal(match[4], sign(`${match[1]}.${match[2]}.${match[3]}`)) ? match[1] : null;
}
function validateClaim(body, sectors) {
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const topic = clean(body.topic || title);
  const ids = new Set(sectors.filter(s => !s.archived).map(s => s.id));
  if (title.length < 6 || title.length > 120 || topic.length < 6 || topic.length > 120 ||
      typeof body.session !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.session) ||
      !Array.isArray(body.sectors) || body.sectors.length < 1 || body.sectors.length > 5 ||
      body.sectors.some(id => !ids.has(id)) || !Array.isArray(body.files) || body.files.length > 12 ||
      body.files.some(file => typeof file !== 'string' || !/^[a-zA-Z0-9_. /-]{1,160}$/.test(file) || file.startsWith('/') || file.split('/').includes('..')) ||
      (body.baseCommit && !/^[a-f0-9]{40}$/.test(body.baseCommit))) return null;
  return { title, topic, session: body.session, sectors: [...new Set(body.sectors)], files: [...new Set(body.files)], baseCommit: body.baseCommit || '' };
}
function publicRecord(record, now = Date.now()) {
  const { session, leaseToken, topic, ...safe } = record;
  return { ...safe, status: record.status === 'active' && record.leaseUntil <= now ? 'interrupted' : record.status };
}
async function listDevelopments(redis, now = Date.now(), key = KEY) {
  const all = await redis.hgetall(key) || {};
  return Object.values(all).map(value => typeof value === 'string' ? JSON.parse(value) : value)
    .map(record => publicRecord(record, now)).filter(record => record.status !== 'cancelled')
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
// Check and reserve happen in a single Redis operation; a stale lease cannot renew or finish.
const MUTATE_SCRIPT = `
local action, actor, now = ARGV[1], ARGV[2], tonumber(ARGV[3])
local input = cjson.decode(ARGV[4])
if action == 'claim' then
  local all = redis.call('HGETALL', KEYS[1])
  for i = 2, #all, 2 do
    local other = cjson.decode(all[i])
    if other.topic == input.topic and (other.status == 'local' or (other.status == 'active' and other.leaseUntil > now)) then
      if other.actor == actor and other.session == input.session and other.status == 'active' then
        other.leaseUntil = input.leaseUntil
        other.updatedAt = now
        redis.call('HSET', KEYS[1], other.id, cjson.encode(other))
        return cjson.encode({record=other})
      end
      return cjson.encode({error='duplicate', conflicting=other.id})
    end
    if other.actor == actor and other.session == input.session and other.status == 'active' and other.leaseUntil > now then
      return cjson.encode({error='session_busy', conflicting=other.id})
    end
  end
  if #all >= 500 then
    local oldestId, oldestTime = nil, now
    for i = 1, #all, 2 do
      local r = cjson.decode(all[i+1])
      if (r.status == 'published' or r.status == 'cancelled') and r.updatedAt < oldestTime then oldestId, oldestTime = all[i], r.updatedAt end
    end
    if oldestId then redis.call('HDEL', KEYS[1], oldestId) else return cjson.encode({error='limit'}) end
  end
  redis.call('HSET', KEYS[1], input.id, cjson.encode(input))
  return cjson.encode({record=input})
end
local raw = redis.call('HGET', KEYS[1], input.id)
if not raw then return cjson.encode({error='missing'}) end
local r = cjson.decode(raw)
if r.actor ~= actor or r.session ~= input.session or r.leaseToken ~= input.leaseToken then return cjson.encode({error='ownership'}) end
if action == 'check' then
  if r.status == 'local' or r.status == 'published' or (r.status == 'active' and r.leaseUntil > now) then return cjson.encode({record=r}) end
  return cjson.encode({error='expired'})
end
if action == 'cancel' then
  if r.status == 'published' then return cjson.encode({error='published'}) end
  r.status, r.leaseUntil = 'cancelled', 0
elseif action == 'interrupt' then
  if r.status ~= 'active' then return cjson.encode({record=r}) end
  r.status, r.leaseUntil = 'interrupted', 0
else
  if r.status ~= 'active' or r.leaseUntil <= now then return cjson.encode({error='expired'}) end
  if action == 'heartbeat' then r.leaseUntil = now + tonumber(ARGV[5])
  elseif action == 'finish' then r.status, r.leaseUntil = 'local', 0
  else return cjson.encode({error='invalid'}) end
end
r.updatedAt = now
redis.call('HSET', KEYS[1], r.id, cjson.encode(r))
return cjson.encode({record=r})`;
function overlaps(record, other) {
  if (record.id === other.id) return false;
  if (record.files.some(file => other.files.includes(file))) return true;
  const words = new Set(clean(record.title).split(' ').filter(word => word.length > 3));
  return other.sectors.some(id => record.sectors.includes(id)) && clean(other.title).split(' ').filter(word => words.has(word)).length >= 2;
}
async function mutate(redis, actor, body, sectors = [], now = Date.now(), key = KEY) {
  let input;
  if (body.action === 'claim') {
    const valid = validateClaim(body, sectors);
    if (!valid) return { error: 'invalid' };
    input = { ...valid, id: randomUUID(), actor, leaseToken: randomUUID(), status: 'active', createdAt: now, updatedAt: now, leaseUntil: now + LEASE_MS };
  } else {
    if (!['check', 'heartbeat', 'finish', 'interrupt', 'cancel'].includes(body.action) || !UUID.test(body.id) ||
        !UUID.test(body.leaseToken) || typeof body.session !== 'string') return { error: 'invalid' };
    input = body;
  }
  const raw = await redis.eval(MUTATE_SCRIPT, [key], [body.action, actor, now, JSON.stringify(input), LEASE_MS]);
  const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (result.record && body.action === 'claim') {
    const others = await listDevelopments(redis, now, key);
    result.warnings = others.filter(other => overlaps(result.record, other)).slice(0, 6);
  }
  return result;
}
const PUBLISH_SCRIPT = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return 0 end
local r = cjson.decode(raw)
if r.status == 'cancelled' then return 0 end
if r.status == 'published' then return 1 end
r.status, r.leaseUntil, r.commit, r.updatedAt = 'published', 0, ARGV[2], tonumber(ARGV[3])
redis.call('HSET', KEYS[1], r.id, cjson.encode(r))
return 1`;
async function confirmPublished(redis, refs, now = Date.now(), key = KEY) {
  for (const ref of refs) await redis.eval(PUBLISH_SCRIPT, [key], [ref.id, ref.commit, now]);
}
module.exports = { KEY, LEASE_MS, ACTORS, clean, equal, issueToken, tokenActor, validateClaim, publicRecord, listDevelopments, mutate, overlaps, confirmPublished };
