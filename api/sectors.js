const { createHmac, timingSafeEqual, randomUUID, createHash } = require('node:crypto');
const { getRedis, readSectors, saveSector, LAST_REPORT_KEY } = require('../lib/sectors.cjs');

function editingCode() {
  // Deployment tools can append a newline when a value is provided through stdin.
  return String(process.env.SECTORS_EDIT_CODE || '').trim();
}

function equal(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

function signed(value) {
  return createHmac('sha256', editingCode()).update(value).digest('hex');
}

function canEdit(request) {
  if (!editingCode()) return false;
  const cookie = String(request.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith('prototype0_sectors='))?.slice('prototype0_sectors='.length) || '';
  const match = /^(\d+)\.([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(cookie);
  return Boolean(match && Number(match[1]) > Date.now() && equal(match[3], signed(`${match[1]}.${match[2]}`)));
}

function sameOrigin(request) {
  try {
    return new URL(request.headers.origin).host === request.headers.host;
  } catch (_) { return false; }
}

function cookieHeader(request, token) {
  const secure = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host || '') ? '' : '; Secure';
  return `prototype0_sectors=${token}; Path=/api; HttpOnly; SameSite=Strict${secure}${token ? '' : '; Max-Age=0'}`;
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Méthode non autorisée.' });
  }
  if (request.method === 'POST' && !sameOrigin(request)) return response.status(403).json({ error: 'Origine non autorisée.' });
  try {
    const redis = getRedis();
    if (request.method === 'POST') {
      const body = request.body || {};
      if (body.action === 'unlock') {
        if (!editingCode()) return response.status(503).json({ error: 'L’accès à l’édition n’est pas encore configuré.' });
        const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
        const key = `prototype0:sectors:unlock:${createHash('sha256').update(ip).digest('hex')}:${Math.floor(Date.now() / 900000)}`;
        const attempts = await redis.incr(key);
        if (attempts === 1) await redis.expire(key, 900);
        if (attempts > 8) return response.status(429).json({ error: 'Trop d’essais. Réessaie dans 15 minutes.' });
        if (typeof body.code !== 'string' || body.code.length > 80 || !equal(body.code.trim(), editingCode())) {
          return response.status(401).json({ error: 'Code incorrect.' });
        }
        const payload = `${Date.now() + 8 * 60 * 60 * 1000}.${randomUUID()}`;
        response.setHeader('Set-Cookie', cookieHeader(request, `${payload}.${signed(payload)}`));
        return response.status(200).json({ canEdit: true });
      }
      if (body.action === 'lock') {
        response.setHeader('Set-Cookie', cookieHeader(request, ''));
        return response.status(200).json({ canEdit: false });
      }
      if (!canEdit(request)) return response.status(401).json({ error: 'Déverrouille l’édition pour modifier la répartition.' });
      await readSectors(redis);
      const result = await saveSector(redis, body);
      const errors = {
        invalid: [400, 'Secteur invalide.'], missing: [404, 'Ce secteur n’existe plus.'],
        conflict: [409, 'Ce secteur a changé sur un autre appareil. La liste a été actualisée ; recommence ta modification.'],
        duplicate: [409, 'Un secteur porte déjà ce nom, y compris dans les archives.'],
        limit: [400, 'La liste peut contenir au maximum 100 secteurs.']
      };
      if (errors[result]) return response.status(errors[result][0]).json({ error: errors[result][1] });
      if (result !== 'saved') throw new Error('Unexpected save result');
    }
    return response.status(200).json({
      sectors: await readSectors(redis), canEdit: canEdit(request), editConfigured: Boolean(editingCode()),
      notification: { configured: Boolean(process.env.SECTORS_DISCORD_WEBHOOK_URL), lastReport: await redis.get(LAST_REPORT_KEY) || null }
    });
  } catch (error) {
    // Do not print upstream errors, which may contain credentials in request URLs.
    console.error('Sector storage failed:', error.name);
    return response.status(503).json({ error: 'La répartition est temporairement indisponible. Réessaie dans un instant.' });
  }
};

module.exports.canEdit = canEdit;
module.exports.sameOrigin = sameOrigin;
