import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---- Contraseñas (scrypt, incluido en Node; no requiere librerías) ----
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(pw, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}
export const esHashValido = (s) => /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(String(s));

// ---- Tokens firmados (HMAC-SHA256) ----
let SECRET = null;
export function initSecret(dir) {
  if (process.env.TOKEN_SECRET) { SECRET = process.env.TOKEN_SECRET; return; }
  const file = path.join(dir, '.secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  SECRET = fs.readFileSync(file, 'utf8').trim();
}
const b64 = (b) => Buffer.from(b).toString('base64url');
export function signToken(payload, ttlMs = 8 * 60 * 60 * 1000) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlMs }));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 1000) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const esperado = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}
