import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PortalStore, PortalUser } from './portal-store';

const SESSION_COOKIE_NAME = 'portal_session';
const PASSWORD_RESET_MIN_TTL_SECONDS = 60;
const PASSWORD_RESET_DEFAULT_TTL_SECONDS = 60 * 30;

function parseCookies(cookieHeader: string | undefined) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = decodeURIComponent(pair.slice(0, idx).trim());
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function hashSecret(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a, 'hex');
  const bBuffer = Buffer.from(b, 'hex');
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashSecret(password, salt);
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHash] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHash) return false;
  const computedHash = hashSecret(password, salt);
  return safeCompare(computedHash, expectedHash);
}

function serializeSessionCookie(token: string, expiresAtIso: string) {
  const isSecure = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const expires = new Date(expiresAtIso);

  const parts = [`${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (!Number.isNaN(expires.getTime())) {
    parts.push(`Expires=${expires.toUTCString()}`);
  }
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

function serializeClearSessionCookie() {
  const isSecure = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0'
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

function parsePasswordResetTtlSeconds() {
  const configured = Number(process.env.PORTAL_PASSWORD_RESET_TTL_MINUTES || '');
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(PASSWORD_RESET_MIN_TTL_SECONDS, Math.trunc(configured * 60));
  }
  return PASSWORD_RESET_DEFAULT_TTL_SECONDS;
}

export type PasswordResetRequestResult = {
  user: PortalUser;
  token: string;
  expiresAt: string;
};

export class AuthService {
  constructor(private readonly store: PortalStore) {}

  ensureBootstrapAdmin() {
    const adminEmail = String(process.env.PORTAL_ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = String(process.env.PORTAL_ADMIN_PASSWORD || '');

    if (!adminEmail || !adminPassword) return null;

    const admin = this.store.createOrUpdateUser(adminEmail, hashPassword(adminPassword));
    return admin;
  }

  createOrUpdateUser(email: string, password: string): PortalUser {
    return this.store.createOrUpdateUser(email, hashPassword(password));
  }

  login(email: string, password: string) {
    const found = this.store.getUserWithPasswordHashByEmail(email);
    if (!found) return null;
    if (!verifyPassword(password, found.passwordHash)) return null;

    const session = this.store.createSession(found.user.id);
    return {
      user: found.user,
      session
    };
  }

  requestPasswordReset(email: string): PasswordResetRequestResult | null {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;
    const found = this.store.getUserWithPasswordHashByEmail(normalizedEmail);
    if (!found) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const ttlSeconds = parsePasswordResetTtlSeconds();
    const resetRecord = this.store.createPasswordResetToken(found.user.id, sha256(token), ttlSeconds);
    return {
      user: found.user,
      token,
      expiresAt: resetRecord.expiresAt
    };
  }

  resetPasswordWithToken(token: string, nextPassword: string) {
    const normalizedToken = String(token || '').trim();
    const normalizedPassword = String(nextPassword || '');
    if (!normalizedToken || normalizedPassword.length < 8) return null;

    const user = this.store.consumePasswordResetToken(sha256(normalizedToken), hashPassword(normalizedPassword));
    if (!user) return null;
    return { user };
  }

  logoutByToken(token: string | undefined) {
    if (!token) return;
    this.store.revokeSession(token);
  }

  getSessionTokenFromRequest(request: FastifyRequest) {
    const cookies = parseCookies(String(request.headers.cookie || ''));
    return cookies[SESSION_COOKIE_NAME] || '';
  }

  setSessionCookie(reply: FastifyReply, token: string, expiresAtIso: string) {
    reply.header('Set-Cookie', serializeSessionCookie(token, expiresAtIso));
  }

  clearSessionCookie(reply: FastifyReply) {
    reply.header('Set-Cookie', serializeClearSessionCookie());
  }

  requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = this.getSessionTokenFromRequest(request);
    if (!token) {
      reply.code(401).send({ ok: false, error: 'Unauthorized' });
      return null;
    }

    const session = this.store.getSession(token);
    if (!session) {
      this.clearSessionCookie(reply);
      reply.code(401).send({ ok: false, error: 'Unauthorized' });
      return null;
    }

    return {
      token,
      user: session.user,
      session: session.session
    };
  }

  requireSiteAccess(request: FastifyRequest, reply: FastifyReply, siteSlug: string) {
    const auth = this.requireAuth(request, reply);
    if (!auth) return null;

    if (!this.store.hasSiteAccess(auth.user.id, siteSlug)) {
      reply.code(403).send({ ok: false, error: 'Forbidden' });
      return null;
    }

    return auth;
  }
}
