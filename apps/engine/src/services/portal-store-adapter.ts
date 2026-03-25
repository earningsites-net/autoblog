import type {
  PortalSession,
  PortalSiteAccess,
  PortalSiteEntitlement,
  PortalSiteSettings,
  PortalSiteSummary,
  PortalUser
} from './portal-store-types';
import { PostgresPortalStore } from './portal-store-postgres';

export interface PortalStoreAdapter {
  close(): Promise<void>;
  createOrUpdateUser(email: string, passwordHash: string): Promise<PortalUser>;
  getUserWithPasswordHashByEmail(
    email: string
  ): Promise<{ user: PortalUser; passwordHash: string } | null>;
  getUserById(userId: number): Promise<PortalUser | null>;
  createSession(userId: number, ttlSeconds?: number): Promise<PortalSession>;
  getSession(token: string): Promise<{ session: PortalSession; user: PortalUser } | null>;
  revokeSession(token: string): Promise<void>;
  createPasswordResetToken(
    userId: number,
    tokenHash: string,
    ttlSeconds?: number
  ): Promise<{ tokenHash: string; userId: number; expiresAt: string; createdAt: string }>;
  consumePasswordResetToken(tokenHash: string, nextPasswordHash: string): Promise<PortalUser | null>;
  assignSiteAccess(userId: number, siteSlug: string, role?: PortalSiteAccess['role']): Promise<void>;
  hasSiteAccess(userId: number, siteSlug: string): Promise<boolean>;
  getSiteSettings(siteSlug: string): Promise<PortalSiteSettings>;
  patchSiteSettings(
    siteSlug: string,
    patch: Partial<Omit<PortalSiteSettings, 'siteSlug' | 'updatedAt'>>
  ): Promise<PortalSiteSettings>;
  getEntitlement(siteSlug: string): Promise<PortalSiteEntitlement>;
  getEntitlementEffective(siteSlug: string): Promise<PortalSiteEntitlement>;
  patchEntitlement(
    siteSlug: string,
    patch: Partial<Omit<PortalSiteEntitlement, 'siteSlug' | 'updatedAt'>>
  ): Promise<PortalSiteEntitlement>;
  incrementPublishedCount(siteSlug: string, incrementBy?: number): Promise<PortalSiteEntitlement>;
  incrementPublishedCountIdempotent(
    siteSlug: string,
    articleId: string,
    incrementBy?: number
  ): Promise<{ counted: boolean; reason: string; entitlement: PortalSiteEntitlement }>;
  listSitesForUser(userId: number): Promise<PortalSiteSummary[]>;
  getSiteSummaryForUser(userId: number, siteSlug: string): Promise<PortalSiteSummary | null>;
  isWebhookEventProcessed(eventId: string): Promise<boolean>;
  markWebhookEventProcessed(eventId: string): Promise<void>;
}

export async function createPortalStore(input: { postgresUrl?: string } = {}): Promise<PortalStoreAdapter> {
  const postgresUrl = String(input.postgresUrl || process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!postgresUrl) {
    throw new Error('PORTAL_DATABASE_URL (or DATABASE_URL) is required for the portal store');
  }
  const store = new PostgresPortalStore(postgresUrl);
  await store.init();
  return store;
}
