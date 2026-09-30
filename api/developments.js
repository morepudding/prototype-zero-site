const { createHash } = require('node:crypto');
const { getRedis, readSectors } = require('../lib/sectors.cjs');
const { ACTORS, equal, issueToken, tokenActor, listDevelopments, mutate } = require('../lib/developments.cjs');

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ error: 'Méthode non autorisée.' });
  try {
    const redis = getRedis();
    if (request.method === 'GET') return response.status(200).json({ developments: await listDevelopments(redis) });
    const body = request.body || {};
    if (body.action === 'pair') {
      const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const key = `prototype0:coordination:pair:${createHash('sha256').update(ip).digest('hex')}:${Math.floor(Date.now() / 900000)}`;
      const attempts = await redis.incr(key);
      if (attempts === 1) await redis.expire(key, 900);
      if (attempts > 8) return response.status(429).json({ error: 'Trop d’essais. Réessaie dans 15 minutes.' });
      const code = String(process.env.SECTORS_EDIT_CODE || '').trim();
      if (!code || typeof body.code !== 'string' || body.code.length > 80 || !equal(body.code.trim(), code) || !ACTORS.includes(body.actor)) {
        return response.status(401).json({ error: 'Identité ou code incorrect.' });
      }
      return response.status(200).json({ actor: body.actor, token: issueToken(body.actor) });
    }
    const actor = tokenActor(String(request.headers.authorization || '').replace(/^Bearer /, ''));
    if (!actor) return response.status(401).json({ error: 'Active la coordination sur cet ordinateur.' });
    const result = await mutate(redis, actor, body, body.action === 'claim' ? await readSectors(redis) : []);
    if (result.error) return response.status(result.error === 'ownership' ? 403 : result.error === 'invalid' ? 400 : 409).json(result);
    return response.status(200).json(result);
  } catch (error) {
    console.error('Development coordination failed:', error.name);
    return response.status(503).json({ error: 'Coordination temporairement indisponible.' });
  }
};
