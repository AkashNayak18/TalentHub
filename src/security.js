import { createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);
const ALGORITHM = 'HS256';

/* ---------- passwords: pbkdf2_sha256$iterations$salt_hex$digest_hex (same format as the Python app) ---------- */
export async function hashPassword(password, iterations) {
  const salt = randomBytes(16);
  const digest = await pbkdf2Async(password, salt, iterations, 32, 'sha256');
  return `pbkdf2_sha256$${iterations}$${salt.toString('hex')}$${digest.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterations, saltHex, digestHex] = stored.split('$');
    if (scheme !== 'pbkdf2_sha256') return false;
    const expected = Buffer.from(digestHex, 'hex');
    const actual = await pbkdf2Async(password, Buffer.from(saltHex, 'hex'), Number(iterations), expected.length, 'sha256');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ---------- JWT (HS256) ---------- */
const b64url = (input) => Buffer.from(input).toString('base64url');
const sign = (data, secret) => createHmac('sha256', secret).update(data).digest();

export function createAccessToken(userId, role, config) {
  const exp = Math.floor(Date.now() / 1000) + config.accessTokenExpireMinutes * 60;
  const head = b64url(JSON.stringify({ alg: ALGORITHM, typ: 'JWT' }));
  const body = b64url(JSON.stringify({ sub: String(userId), role, exp }));
  return `${head}.${body}.${sign(`${head}.${body}`, config.secretKey).toString('base64url')}`;
}

/** Returns the payload, or throws if the token is malformed, tampered with or expired. */
export function decodeAccessToken(token, config) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [head, body, sig] = parts;
  const header = JSON.parse(Buffer.from(head, 'base64url').toString());
  if (header.alg !== ALGORITHM) throw new Error('unexpected algorithm');
  const expected = sign(`${head}.${body}`, config.secretKey);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error('bad signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now() / 1000) throw new Error('token expired');
  return payload;
}
