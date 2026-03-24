import { PortalStore as SqlitePortalStore } from './portal-store';
import type {
  PortalAdminDbTable,
  PortalAdminDbTableSnapshot,
  PortalSession,
  PortalSiteAccess,
  PortalSiteEntitlement,
  PortalSiteSettings,
  PortalSiteSummary,
  PortalUser
} from './portal-store';
import { PostgresPortalStore } from './portal-store-postgres';

export type PortalStoreProvider = 'sqlite' | 'postgres';

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
  listAdminDbTables(): PortalAdminDbTable[];
  getAdminDbTableSnapshot(table: PortalAdminDbTable, limit?: number): Promise<PortalAdminDbTableSnapshot>;
}

class AsyncSqlitePortalStore implements PortalStoreAdapter {
  constructor(private readonly store: SqlitePortalStore) {}

  async close() {
    this.store.close();
  }

  async createOrUpdateUser(email: string, passwordHash: string) {
    return this.store.createOrUpdateUser(email, passwordHash);
  }

  async getUserWithPasswordHashByEmail(email: string) {
    return this.store.getUserWithPasswordHashByEmail(email);
  }

  async getUserById(userId: number) {
    return this.store.getUserById(userId);
  }

  async createSession(userId: number, ttlSeconds = 60 * 60 * 24 * 14) {
    return this.store.createSession(userId, ttlSeconds);
  }

  async getSession(token: string) {
    return this.store.getSession(token);
  }

  async revokeSession(token: string) {
    this.store.revokeSession(token);
  }

  async createPasswordResetToken(userId: number, tokenHash: string, ttlSeconds = 60 * 30) {
    return this.store.createPasswordResetToken(userId, tokenHash, ttlSeconds);
  }

  async consumePasswordResetToken(tokenHash: string, nextPasswordHash: string) {
    return this.store.consumePasswordResetToken(tokenHash, nextPasswordHash);
  }

  async assignSiteAccess(userId: number, siteSlug: string, role: PortalSiteAccess['role'] = 'owner') {
    this.store.assignSiteAccess(userId, siteSlug, role);
  }

  async hasSiteAccess(userId: number, siteSlug: string) {
    return this.store.hasSiteAccess(userId, siteSlug);
  }

  async getSiteSettings(siteSlug: string) {
    return this.store.getSiteSettings(siteSlug);
  }

  async patchSiteSettings(siteSlug: string, patch: Partial<Omit<PortalSiteSettings, 'siteSlug' | 'updatedAt'>>) {
    return this.store.patchSiteSettings(siteSlug, patch);
  }

  async getEntitlement(siteSlug: string) {
    return this.store.getEntitlement(siteSlug);
  }

  async getEntitlementEffective(siteSlug: string) {
    return this.store.getEntitlementEffective(siteSlug);
  }

  async patchEntitlement(siteSlug: string, patch: Partial<Omit<PortalSiteEntitlement, 'siteSlug' | 'updatedAt'>>) {
    return this.store.patchEntitlement(siteSlug, patch);
  }

  async incrementPublishedCount(siteSlug: string, incrementBy = 1) {
    return this.store.incrementPublishedCount(siteSlug, incrementBy);
  }

  async incrementPublishedCountIdempotent(siteSlug: string, articleId: string, incrementBy = 1) {
    return this.store.incrementPublishedCountIdempotent(siteSlug, articleId, incrementBy);
  }

  async listSitesForUser(userId: number) {
    return this.store.listSitesForUser(userId);
  }

  async getSiteSummaryForUser(userId: number, siteSlug: string) {
    return this.store.getSiteSummaryForUser(userId, siteSlug);
  }

  async isWebhookEventProcessed(eventId: string) {
    return this.store.isWebhookEventProcessed(eventId);
  }

  async markWebhookEventProcessed(eventId: string) {
    this.store.markWebhookEventProcessed(eventId);
  }

  listAdminDbTables() {
    return this.store.listAdminDbTables();
  }

  async getAdminDbTableSnapshot(table: PortalAdminDbTable, limit = 100) {
    return this.store.getAdminDbTableSnapshot(table, limit);
  }
}

export async function createPortalStore(input: {
  sqlitePath: string;
  provider?: string;
  postgresUrl?: string;
}): Promise<PortalStoreAdapter> {
  const providerRaw = String(input.provider || process.env.PORTAL_STORE_PROVIDER || 'sqlite')
    .trim()
    .toLowerCase();
  const provider: PortalStoreProvider = providerRaw === 'postgres' ? 'postgres' : 'sqlite';

  if (provider === 'postgres') {
    const postgresUrl = String(input.postgresUrl || process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL || '').trim();
    if (!postgresUrl) {
      throw new Error('PORTAL_DATABASE_URL (or DATABASE_URL) is required when PORTAL_STORE_PROVIDER=postgres');
    }
    const store = new PostgresPortalStore(postgresUrl);
    await store.init();
    return store;
  }

  return new AsyncSqlitePortalStore(new SqlitePortalStore(input.sqlitePath));
}
