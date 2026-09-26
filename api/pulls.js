const { Redis } = require('@upstash/redis');
const { pushes } = require('../dist/data/patchs.json');

const READERS = new Set(['BotteroRomain', 'aKoMoses']);
const KEY_PREFIX = 'prototype0:game-pull:';

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('Redis is not configured');
  }
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN
  });
}

function recordKey(commit, reader) {
  return `${KEY_PREFIX}${commit}:${reader}`;
}

function validPair(commit, reader) {
  return READERS.has(reader) && pushes.some(push => push.commit === commit && push.author !== reader);
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
      const { commit, reader } = request.body || {};
      if (typeof commit !== 'string' || typeof reader !== 'string' || !validPair(commit, reader)) {
        return response.status(400).json({ error: 'Confirmation invalide.' });
      }
      await redis.setnx(recordKey(commit, reader), new Date().toISOString());
      const pulledAt = await redis.get(recordKey(commit, reader));
      return response.status(200).json({ record: { commit, reader, pulledAt } });
    }

    const pairs = pushes.flatMap(push => [...READERS]
      .filter(reader => reader !== push.author)
      .map(reader => ({ commit: push.commit, reader })));
    const records = await Promise.all(pairs.map(async ({ commit, reader }) => ({
      commit,
      reader,
      pulledAt: await redis.get(recordKey(commit, reader)) || null
    })));
    return response.status(200).json({ records });
  } catch (error) {
    console.error('Pull status storage failed:', error);
    return response.status(503).json({ error: 'Suivi temporairement indisponible.' });
  }
};
