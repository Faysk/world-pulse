import { createHash, randomBytes, randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function normalizeHashtag(input) {
  if (typeof input !== 'string') throw new ApiError(400, 'invalid_hashtag', 'Hashtag inválida.');
  const name = input.normalize('NFKC').trim().replace(/^#+/, '').toLocaleLowerCase('und');
  if (name.length < 2 || name.length > 32 || !/^[\p{L}\p{N}_]+$/u.test(name)) {
    throw new ApiError(400, 'invalid_hashtag', 'Use 2 a 32 letras, números ou _.');
  }
  return name;
}

export function validateTagId(tagId) {
  if (typeof tagId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tagId)) {
    throw new ApiError(400, 'invalid_tag_id', 'ID de hashtag inválido.');
  }
  return tagId.toLowerCase();
}

export function validateTapBatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'invalid_body', 'Corpo JSON inválido.');
  }
  const tagId = validateTagId(body.tagId);
  const batchId = validateTagId(body.batchId);
  // A client can only claim small finite click batches. Never infer clicks
  // from wall time and never accept arbitrarily large totals.
  if (!Number.isSafeInteger(body.clicks) || body.clicks < 1 || body.clicks > 30) {
    throw new ApiError(400, 'invalid_click_count', 'Lote deve conter entre 1 e 30 toques.');
  }
  return { tagId, batchId, clicks: body.clicks };
}

export function randomColor() {
  // Deliberately vivid, high-contrast HSL -> RGB for per-tag persistence.
  const hue = randomBytes(2).readUInt16BE(0) % 360;
  const s = 0.72;
  const l = 0.63;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - chroma / 2;
  const [r,g,b] = hue < 60 ? [chroma,x,0] : hue < 120 ? [x,chroma,0] :
    hue < 180 ? [0,chroma,x] : hue < 240 ? [0,x,chroma] :
    hue < 300 ? [x,0,chroma] : [chroma,0,x];
  return '#' + [r,g,b].map(c => Math.round((c + m) * 255).toString(16).padStart(2,'0')).join('');
}

export function newSession() {
  const token = randomBytes(32).toString('base64url');
  return { visitorId: randomUUID(), token, hash: tokenHash(token) };
}

export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function batchFingerprint(tagId, clicks) {
  return createHash('sha256').update(tagId + ':' + clicks).digest('hex');
}

export function readSessionCookie(req) {
  const cookies = String(req.headers?.cookie || '').split(';');
  const value = cookies.map(s => s.trim()).find(s => s.startsWith('wp_session='));
  const token = value?.slice('wp_session='.length);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function requireSameOrigin(req) {
  const origin = req.headers?.origin;
  const host = req.headers?.host;
  if (typeof origin !== 'string' || typeof host !== 'string') {
    throw new ApiError(403, 'origin_required', 'Origem da requisição não identificada.');
  }
  let url;
  try { url = new URL(origin); } catch {
    throw new ApiError(403, 'invalid_origin', 'Origem inválida.');
  }
  const expected = process.env.NODE_ENV === 'development' ? 'http:' : 'https:';
  if (url.protocol !== expected || url.host.toLowerCase() !== host.toLowerCase() || url.username || url.password) {
    throw new ApiError(403, 'cross_origin', 'Requisição de origem externa não permitida.');
  }
}

export function parseBody(req) {
  const length = Number(req.headers?.['content-length'] ?? '0');
  if (Number.isFinite(length) && length > 8192) throw new ApiError(413, 'payload_too_large', 'Limite do pedido excedido.');
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 8192) {
    throw new ApiError(400, 'invalid_body', 'Objeto JSON obrigatório.');
  }
  return body;
}

export function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).end(JSON.stringify(data));
}

export function fail(res, error) {
  const e = error instanceof ApiError ? error : new ApiError(500, 'internal_error', 'Falha temporária.');
  if (!(error instanceof ApiError)) console.error('World Pulse API failure:', error?.name || 'unknown');
  return json(res, e.status, { error: e.code, message: e.message });
}

export function onlyMethod(req, method) {
  if (req.method !== method) throw new ApiError(405, 'method_not_allowed', 'Método não permitido.');
}
