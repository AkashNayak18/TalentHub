/** Request helpers: body reading/parsing and the authentication guards ("dependencies"). */
import { Role } from '../enums.js';
import { AuthenticationError, ForbiddenError, ValidationError } from '../errors.js';
import { UserRepository } from '../repositories/user-repository.js';
import { decodeAccessToken } from '../security.js';

const MAX_BODY_BYTES = 1_000_000;

export async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ValidationError([{ type: 'too_large', loc: ['body'], msg: 'Request body too large' }]);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Parse a raw body according to its content type. Returns { present, data } (data undefined if absent). */
export function parseBody(raw, contentType = '') {
  if (!raw.trim()) return { present: false, data: undefined };
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return { present: true, data: Object.fromEntries(new URLSearchParams(raw)) };
  }
  try {
    return { present: true, data: JSON.parse(raw) };
  } catch {
    throw new ValidationError([{ type: 'json_invalid', loc: ['body'], msg: 'JSON decode error' }]);
  }
}

/** Resolve the authenticated user (+ student/company profile) from the Authorization header. */
export function authenticate(req, { db, config }) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw new AuthenticationError('Not authenticated');

  let userId;
  try {
    userId = Number(decodeAccessToken(token, config).sub);
    if (!Number.isInteger(userId)) throw new Error('bad sub');
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
  const users = new UserRepository(db);
  const user = users.get(userId);
  if (!user || !user.is_active) throw new AuthenticationError('User no longer exists or is inactive');
  return {
    user,
    student: user.role === Role.STUDENT ? users.getStudentByUserId(user.id) : null,
    company: user.role === Role.COMPANY ? users.getCompanyByUserId(user.id) : null,
  };
}

export function requireRoles(user, roles) {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError(`This action requires one of the roles: ${roles.join(', ')}`);
  }
}
