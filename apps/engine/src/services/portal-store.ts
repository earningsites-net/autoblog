import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getCurrentMonthWindow, getQuotaForPlan, isIsoBefore, normalizePlan } from '../config/plans';

export type PortalUser = {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type PortalSession = {
  token: string;
  userId: number;
  expiresAt: string;
  createdAt: string;
};

export type PortalSiteAccess = {
  siteSlug: string;
  role: 'owner' | 'editor' | 'viewer';
};

export type PortalSiteSettings = {
  siteSlug: string;
  publishingEnabled: boolean;
  maxPublishesPerRun: number;
  adSlotsEnabled: boolean;
  adsMode: 'auto' | 'manual' | 'hybrid';
  adsPreviewEnabled: boolean;
  adsensePublisherId: string;
  adsenseSlotHeader: string;
  adsenseSlotInContent: string;
  adsenseSlotFooter: string;
  fallbackToPlatform: boolean;
  studioUrl: string;
  updatedAt: string;
};

export type PortalSiteEntitlement = {
  siteSlug: string;
  plan: 'base' | 'standard' | 'pro';
  monthlyQuota: number;
  publishedThisMonth: number;
  periodStart: string;
  periodEnd: string;
  status: 'active' | 'paused' | 'stopped';
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  billingStatus: 'n/a' | 'trial' | 'active' | 'overdue' | 'canceled';
  updatedAt: string;
};

export type PortalSiteSummary = {
  siteSlug: string;
  role: 'owner' | 'editor' | 'viewer';
  settings: PortalSiteSettings;
  entitlement: PortalSiteEntitlement;
};

export type PortalAdminDbTable =
  | 'users'
  | 'sessions'
  | 'site_access'
  | 'site_settings'
  | 'entitlements'
  | 'processed_webhook_events'
  | 'published_article_events';

export type PortalAdminDbTableSnapshot = {
  table: PortalAdminDbTable;
  count: number;
  rows: Record<string, string | number | boolean | null>[];
};

function isoNow() {
  return new Date().toISOString();
}

function toBool(value: number | bigint | null | undefined) {
  return Number(value || 0) === 1;
}

function normalizeSiteSlug(siteSlug: string) {
  return String(siteSlug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class PortalStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS site_access (
        user_id INTEGER NOT NULL,
        site_slug TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'owner',
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, site_slug),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        site_slug TEXT PRIMARY KEY,
        publishing_enabled INTEGER NOT NULL DEFAULT 1,
        max_publishes_per_run INTEGER NOT NULL DEFAULT 1,
        ad_slots_enabled INTEGER NOT NULL DEFAULT 0,
        ads_mode TEXT NOT NULL DEFAULT 'auto',
        ads_preview_enabled INTEGER NOT NULL DEFAULT 1,
        adsense_publisher_id TEXT NOT NULL DEFAULT '',
        adsense_slot_header TEXT NOT NULL DEFAULT '',
        adsense_slot_in_content TEXT NOT NULL DEFAULT '',
        adsense_slot_footer TEXT NOT NULL DEFAULT '',
        fallback_to_platform INTEGER NOT NULL DEFAULT 1,
        studio_url TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entitlements (
        site_slug TEXT PRIMARY KEY,
        plan TEXT NOT NULL DEFAULT 'base',
        monthly_quota INTEGER NOT NULL DEFAULT 3,
        published_this_month INTEGER NOT NULL DEFAULT 0,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        stripe_customer_id TEXT NOT NULL DEFAULT '',
        stripe_subscription_id TEXT NOT NULL DEFAULT '',
        stripe_price_id TEXT NOT NULL DEFAULT '',
        billing_status TEXT NOT NULL DEFAULT 'trial',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processed_webhook_events (
        event_id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS published_article_events (
        site_slug TEXT NOT NULL,
        article_id TEXT NOT NULL,
        increment_by INTEGER NOT NULL DEFAULT 1,
        counted_at TEXT NOT NULL,
        PRIMARY KEY (site_slug, article_id)
      );
    `);

    this.ensureColumnExists('site_settings', 'ads_mode', "TEXT NOT NULL DEFAULT 'auto'");
    this.ensureColumnExists('site_settings', 'ads_preview_enabled', 'INTEGER NOT NULL DEFAULT 1');
  }

  private ensureColumnExists(table: string, column: string, definition: string) {
    const rows = this.db
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    const exists = rows.some((row) => row.name === column);
    if (!exists) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    }
  }

  close() {
    this.db.close();
  }

  createOrUpdateUser(email: string, passwordHash: string): PortalUser {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const now = isoNow();

    const existing = this.db
      .prepare('SELECT id, email, created_at, updated_at FROM users WHERE email = ?')
      .get(normalizedEmail) as
      | { id: number; email: string; created_at: string; updated_at: string }
      | undefined;

    if (existing) {
      this.db
        .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(passwordHash, now, existing.id);
      return {
        id: existing.id,
        email: existing.email,
        createdAt: existing.created_at,
        updatedAt: now
      };
    }

    const result = this.db
      .prepare('INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(normalizedEmail, passwordHash, now, now);

    return {
      id: Number(result.lastInsertRowid),
      email: normalizedEmail,
      createdAt: now,
      updatedAt: now
    };
  }

  getUserWithPasswordHashByEmail(email: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const row = this.db
      .prepare('SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = ?')
      .get(normalizedEmail) as
      | { id: number; email: string; password_hash: string; created_at: string; updated_at: string }
      | undefined;

    if (!row) return null;
    return {
      user: {
        id: row.id,
        email: row.email,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      } satisfies PortalUser,
      passwordHash: row.password_hash
    };
  }

  getUserById(userId: number): PortalUser | null {
    const row = this.db
      .prepare('SELECT id, email, created_at, updated_at FROM users WHERE id = ?')
      .get(userId) as { id: number; email: string; created_at: string; updated_at: string } | undefined;

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  createSession(userId: number, ttlSeconds = 60 * 60 * 24 * 14): PortalSession {
    const createdAt = isoNow();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const token = crypto.randomBytes(32).toString('hex');

    this.db
      .prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(token, userId, expiresAt, createdAt);

    return {
      token,
      userId,
      expiresAt,
      createdAt
    };
  }

  getSession(token: string) {
    const nowIso = isoNow();
    const row = this.db
      .prepare(
        `SELECT s.token, s.user_id, s.expires_at, s.created_at, u.email, u.created_at AS user_created_at, u.updated_at AS user_updated_at
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(token) as
      | {
          token: string;
          user_id: number;
          expires_at: string;
          created_at: string;
          email: string;
          user_created_at: string;
          user_updated_at: string;
        }
      | undefined;

    if (!row) return null;

    if (!isIsoBefore(nowIso, row.expires_at)) {
      this.revokeSession(token);
      return null;
    }

    return {
      session: {
        token: row.token,
        userId: row.user_id,
        expiresAt: row.expires_at,
        createdAt: row.created_at
      } satisfies PortalSession,
      user: {
        id: row.user_id,
        email: row.email,
        createdAt: row.user_created_at,
        updatedAt: row.user_updated_at
      } satisfies PortalUser
    };
  }

  revokeSession(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  assignSiteAccess(userId: number, siteSlug: string, role: PortalSiteAccess['role'] = 'owner') {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const now = isoNow();
    if (!normalizedSlug) return;

    this.ensureSiteRecords(normalizedSlug);

    this.db
      .prepare(
        `INSERT INTO site_access (user_id, site_slug, role, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, site_slug) DO UPDATE SET role = excluded.role`
      )
      .run(userId, normalizedSlug, role, now);
  }

  hasSiteAccess(userId: number, siteSlug: string) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    if (!normalizedSlug) return false;
    const row = this.db
      .prepare('SELECT site_slug FROM site_access WHERE user_id = ? AND site_slug = ?')
      .get(userId, normalizedSlug) as { site_slug: string } | undefined;
    return Boolean(row?.site_slug);
  }

  private ensureSiteRecords(siteSlug: string) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const now = isoNow();
    const window = getCurrentMonthWindow();

    this.db
      .prepare(
        `INSERT INTO site_settings (
          site_slug, publishing_enabled, max_publishes_per_run, ad_slots_enabled,
          ads_mode, ads_preview_enabled,
          adsense_publisher_id, adsense_slot_header, adsense_slot_in_content, adsense_slot_footer,
          fallback_to_platform, studio_url, updated_at
        ) VALUES (?, 1, 1, 0, 'auto', 1, '', '', '', '', 1, '', ?)
        ON CONFLICT(site_slug) DO NOTHING`
      )
      .run(normalizedSlug, now);

    this.db
      .prepare(
        `INSERT INTO entitlements (
          site_slug, plan, monthly_quota, published_this_month, period_start, period_end,
          status, stripe_customer_id, stripe_subscription_id, stripe_price_id, billing_status, updated_at
        ) VALUES (?, 'base', ?, 0, ?, ?, 'active', '', '', '', 'trial', ?)
        ON CONFLICT(site_slug) DO NOTHING`
      )
      .run(normalizedSlug, getQuotaForPlan('base'), window.periodStartIso, window.periodEndIso, now);
  }

  getSiteSettings(siteSlug: string): PortalSiteSettings {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    this.ensureSiteRecords(normalizedSlug);

    const row = this.db
      .prepare(
        `SELECT
          site_slug,
          publishing_enabled,
          max_publishes_per_run,
          ad_slots_enabled,
          ads_mode,
          ads_preview_enabled,
          adsense_publisher_id,
          adsense_slot_header,
          adsense_slot_in_content,
          adsense_slot_footer,
          fallback_to_platform,
          studio_url,
          updated_at
         FROM site_settings
         WHERE site_slug = ?`
      )
      .get(normalizedSlug) as
      | {
          site_slug: string;
          publishing_enabled: number;
          max_publishes_per_run: number;
          ad_slots_enabled: number;
          ads_mode: string;
          ads_preview_enabled: number;
          adsense_publisher_id: string;
          adsense_slot_header: string;
          adsense_slot_in_content: string;
          adsense_slot_footer: string;
          fallback_to_platform: number;
          studio_url: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      const now = isoNow();
      return {
        siteSlug: normalizedSlug,
        publishingEnabled: true,
        maxPublishesPerRun: 1,
        adSlotsEnabled: false,
        adsMode: 'auto',
        adsPreviewEnabled: true,
        adsensePublisherId: '',
        adsenseSlotHeader: '',
        adsenseSlotInContent: '',
        adsenseSlotFooter: '',
        fallbackToPlatform: true,
        studioUrl: '',
        updatedAt: now
      };
    }

    return {
      siteSlug: row.site_slug,
      publishingEnabled: toBool(row.publishing_enabled),
      maxPublishesPerRun: Number(row.max_publishes_per_run || 1),
      adSlotsEnabled: toBool(row.ad_slots_enabled),
      adsMode:
        row.ads_mode === 'manual' || row.ads_mode === 'hybrid' || row.ads_mode === 'auto'
          ? row.ads_mode
          : 'auto',
      adsPreviewEnabled: toBool(row.ads_preview_enabled),
      adsensePublisherId: row.adsense_publisher_id || '',
      adsenseSlotHeader: row.adsense_slot_header || '',
      adsenseSlotInContent: row.adsense_slot_in_content || '',
      adsenseSlotFooter: row.adsense_slot_footer || '',
      fallbackToPlatform: toBool(row.fallback_to_platform),
      studioUrl: row.studio_url || '',
      updatedAt: row.updated_at
    };
  }

  patchSiteSettings(siteSlug: string, patch: Partial<Omit<PortalSiteSettings, 'siteSlug' | 'updatedAt'>>) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    this.ensureSiteRecords(normalizedSlug);
    const current = this.getSiteSettings(normalizedSlug);
    const updatedAt = isoNow();

    const next: PortalSiteSettings = {
      ...current,
      publishingEnabled: patch.publishingEnabled ?? current.publishingEnabled,
      maxPublishesPerRun: patch.maxPublishesPerRun ?? current.maxPublishesPerRun,
      adSlotsEnabled: patch.adSlotsEnabled ?? current.adSlotsEnabled,
      adsMode: patch.adsMode ?? current.adsMode,
      adsPreviewEnabled: patch.adsPreviewEnabled ?? current.adsPreviewEnabled,
      adsensePublisherId: patch.adsensePublisherId ?? current.adsensePublisherId,
      adsenseSlotHeader: patch.adsenseSlotHeader ?? current.adsenseSlotHeader,
      adsenseSlotInContent: patch.adsenseSlotInContent ?? current.adsenseSlotInContent,
      adsenseSlotFooter: patch.adsenseSlotFooter ?? current.adsenseSlotFooter,
      fallbackToPlatform: patch.fallbackToPlatform ?? current.fallbackToPlatform,
      studioUrl: patch.studioUrl ?? current.studioUrl,
      updatedAt
    };

    this.db
      .prepare(
        `UPDATE site_settings
         SET
         publishing_enabled = ?,
         max_publishes_per_run = ?,
         ad_slots_enabled = ?,
          ads_mode = ?,
          ads_preview_enabled = ?,
          adsense_publisher_id = ?,
          adsense_slot_header = ?,
          adsense_slot_in_content = ?,
          adsense_slot_footer = ?,
          fallback_to_platform = ?,
          studio_url = ?,
          updated_at = ?
         WHERE site_slug = ?`
      )
      .run(
        next.publishingEnabled ? 1 : 0,
        Math.max(1, Number(next.maxPublishesPerRun || 1)),
        next.adSlotsEnabled ? 1 : 0,
        next.adsMode === 'manual' || next.adsMode === 'hybrid' ? next.adsMode : 'auto',
        next.adsPreviewEnabled ? 1 : 0,
        String(next.adsensePublisherId || '').trim(),
        String(next.adsenseSlotHeader || '').trim(),
        String(next.adsenseSlotInContent || '').trim(),
        String(next.adsenseSlotFooter || '').trim(),
        next.fallbackToPlatform ? 1 : 0,
        String(next.studioUrl || '').trim(),
        updatedAt,
        normalizedSlug
      );

    return this.getSiteSettings(normalizedSlug);
  }

  getEntitlement(siteSlug: string): PortalSiteEntitlement {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    this.ensureSiteRecords(normalizedSlug);

    const row = this.db
      .prepare(
        `SELECT
          site_slug,
          plan,
          monthly_quota,
          published_this_month,
          period_start,
          period_end,
          status,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_price_id,
          billing_status,
          updated_at
         FROM entitlements
         WHERE site_slug = ?`
      )
      .get(normalizedSlug) as
      | {
          site_slug: string;
          plan: string;
          monthly_quota: number;
          published_this_month: number;
          period_start: string;
          period_end: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          billing_status: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      const window = getCurrentMonthWindow();
      const now = isoNow();
      return {
        siteSlug: normalizedSlug,
        plan: 'base',
        monthlyQuota: getQuotaForPlan('base'),
        publishedThisMonth: 0,
        periodStart: window.periodStartIso,
        periodEnd: window.periodEndIso,
        status: 'active',
        stripeCustomerId: '',
        stripeSubscriptionId: '',
        stripePriceId: '',
        billingStatus: 'trial',
        updatedAt: now
      };
    }

    const plan = normalizePlan(row.plan);
    return {
      siteSlug: row.site_slug,
      plan,
      monthlyQuota: Number(row.monthly_quota || getQuotaForPlan(plan)),
      publishedThisMonth: Number(row.published_this_month || 0),
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status === 'paused' || row.status === 'stopped' ? row.status : 'active',
      stripeCustomerId: row.stripe_customer_id || '',
      stripeSubscriptionId: row.stripe_subscription_id || '',
      stripePriceId: row.stripe_price_id || '',
      billingStatus:
        row.billing_status === 'active' ||
        row.billing_status === 'overdue' ||
        row.billing_status === 'canceled' ||
        row.billing_status === 'trial'
          ? row.billing_status
          : 'n/a',
      updatedAt: row.updated_at
    };
  }

  private maybeResetEntitlementPeriod(siteSlug: string) {
    const current = this.getEntitlement(siteSlug);
    const nowIso = isoNow();
    if (isIsoBefore(nowIso, current.periodEnd)) {
      return current;
    }

    const window = getCurrentMonthWindow();
    this.db
      .prepare(
        `UPDATE entitlements
         SET published_this_month = 0, period_start = ?, period_end = ?, updated_at = ?
         WHERE site_slug = ?`
      )
      .run(window.periodStartIso, window.periodEndIso, nowIso, normalizeSiteSlug(siteSlug));

    return this.getEntitlement(siteSlug);
  }

  patchEntitlement(siteSlug: string, patch: Partial<Omit<PortalSiteEntitlement, 'siteSlug' | 'updatedAt'>>) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    this.ensureSiteRecords(normalizedSlug);

    const current = this.maybeResetEntitlementPeriod(normalizedSlug);
    const window = getCurrentMonthWindow();
    const updatedAt = isoNow();
    const nextPlan = normalizePlan(patch.plan ?? current.plan);

    const next: PortalSiteEntitlement = {
      ...current,
      plan: nextPlan,
      monthlyQuota: Number(patch.monthlyQuota ?? current.monthlyQuota ?? getQuotaForPlan(nextPlan)),
      publishedThisMonth: Number(patch.publishedThisMonth ?? current.publishedThisMonth ?? 0),
      periodStart: String(patch.periodStart ?? current.periodStart ?? window.periodStartIso),
      periodEnd: String(patch.periodEnd ?? current.periodEnd ?? window.periodEndIso),
      status:
        patch.status === 'paused' || patch.status === 'stopped' || patch.status === 'active'
          ? patch.status
          : current.status,
      stripeCustomerId: String(patch.stripeCustomerId ?? current.stripeCustomerId ?? ''),
      stripeSubscriptionId: String(patch.stripeSubscriptionId ?? current.stripeSubscriptionId ?? ''),
      stripePriceId: String(patch.stripePriceId ?? current.stripePriceId ?? ''),
      billingStatus:
        patch.billingStatus === 'trial' ||
        patch.billingStatus === 'active' ||
        patch.billingStatus === 'overdue' ||
        patch.billingStatus === 'canceled' ||
        patch.billingStatus === 'n/a'
          ? patch.billingStatus
          : current.billingStatus,
      updatedAt
    };

    this.db
      .prepare(
        `UPDATE entitlements
         SET
          plan = ?,
          monthly_quota = ?,
          published_this_month = ?,
          period_start = ?,
          period_end = ?,
          status = ?,
          stripe_customer_id = ?,
          stripe_subscription_id = ?,
          stripe_price_id = ?,
          billing_status = ?,
          updated_at = ?
         WHERE site_slug = ?`
      )
      .run(
        next.plan,
        Math.max(0, Number(next.monthlyQuota || 0)),
        Math.max(0, Number(next.publishedThisMonth || 0)),
        next.periodStart,
        next.periodEnd,
        next.status,
        next.stripeCustomerId,
        next.stripeSubscriptionId,
        next.stripePriceId,
        next.billingStatus,
        updatedAt,
        normalizedSlug
      );

    return this.getEntitlement(normalizedSlug);
  }

  incrementPublishedCount(siteSlug: string, incrementBy = 1) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const current = this.maybeResetEntitlementPeriod(normalizedSlug);
    const nextPublished = Math.max(0, Number(current.publishedThisMonth || 0) + Math.max(0, incrementBy));
    return this.patchEntitlement(normalizedSlug, { publishedThisMonth: nextPublished });
  }

  incrementPublishedCountIdempotent(siteSlug: string, articleId: string, incrementBy = 1) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const normalizedArticleId = String(articleId || '').trim();
    if (!normalizedSlug || !normalizedArticleId) {
      return {
        counted: false,
        reason: 'missing_site_or_article',
        entitlement: this.getEntitlement(normalizedSlug || siteSlug)
      };
    }

    this.ensureSiteRecords(normalizedSlug);
    const now = isoNow();
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO published_article_events (site_slug, article_id, increment_by, counted_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(normalizedSlug, normalizedArticleId, Math.max(1, Number(incrementBy || 1)), now);

    const inserted = Number(result.changes || 0) > 0;
    if (!inserted) {
      return {
        counted: false,
        reason: 'already_counted',
        entitlement: this.getEntitlement(normalizedSlug)
      };
    }

    return {
      counted: true,
      reason: 'counted',
      entitlement: this.incrementPublishedCount(normalizedSlug, incrementBy)
    };
  }

  listSitesForUser(userId: number): PortalSiteSummary[] {
    const rows = this.db
      .prepare(
        `SELECT sa.site_slug, sa.role
         FROM site_access sa
         WHERE sa.user_id = ?
         ORDER BY sa.site_slug ASC`
      )
      .all(userId) as Array<{ site_slug: string; role: 'owner' | 'editor' | 'viewer' }>;

    return rows.map((row) => {
      const siteSlug = normalizeSiteSlug(row.site_slug);
      return {
        siteSlug,
        role: row.role,
        settings: this.getSiteSettings(siteSlug),
        entitlement: this.getEntitlement(siteSlug)
      };
    });
  }

  getSiteSummaryForUser(userId: number, siteSlug: string): PortalSiteSummary | null {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    if (!this.hasSiteAccess(userId, normalizedSlug)) return null;

    const row = this.db
      .prepare('SELECT role FROM site_access WHERE user_id = ? AND site_slug = ?')
      .get(userId, normalizedSlug) as { role: 'owner' | 'editor' | 'viewer' } | undefined;

    return {
      siteSlug: normalizedSlug,
      role: row?.role || 'viewer',
      settings: this.getSiteSettings(normalizedSlug),
      entitlement: this.getEntitlement(normalizedSlug)
    };
  }

  isWebhookEventProcessed(eventId: string) {
    const row = this.db
      .prepare('SELECT event_id FROM processed_webhook_events WHERE event_id = ?')
      .get(eventId) as { event_id: string } | undefined;
    return Boolean(row?.event_id);
  }

  markWebhookEventProcessed(eventId: string) {
    if (!eventId) return;
    this.db
      .prepare('INSERT OR IGNORE INTO processed_webhook_events (event_id, received_at) VALUES (?, ?)')
      .run(eventId, isoNow());
  }

  listAdminDbTables(): PortalAdminDbTable[] {
    return [
      'users',
      'sessions',
      'site_access',
      'site_settings',
      'entitlements',
      'processed_webhook_events',
      'published_article_events'
    ];
  }

  getAdminDbTableSnapshot(table: PortalAdminDbTable, limit = 100): PortalAdminDbTableSnapshot {
    const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
    const safeTable: PortalAdminDbTable = this.listAdminDbTables().includes(table) ? table : 'users';

    if (safeTable === 'users') {
      const rows = this.db
        .prepare(
          `SELECT id, email, created_at AS createdAt, updated_at AS updatedAt
           FROM users
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(safeLimit) as Array<Record<string, string | number>>;
      const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
      return {
        table: safeTable,
        count: Number(countRow.count || 0),
        rows
      };
    }

    if (safeTable === 'sessions') {
      const rowsRaw = this.db
        .prepare(
          `SELECT
            s.token,
            s.user_id AS userId,
            u.email,
            s.expires_at AS expiresAt,
            s.created_at AS createdAt
           FROM sessions s
           INNER JOIN users u ON u.id = s.user_id
           ORDER BY s.created_at DESC
           LIMIT ?`
        )
        .all(safeLimit) as Array<{
        token: string;
        userId: number;
        email: string;
        expiresAt: string;
        createdAt: string;
      }>;
      const rows = rowsRaw.map((row) => ({
        tokenPreview: row.token ? `${row.token.slice(0, 8)}...${row.token.slice(-4)}` : '',
        userId: row.userId,
        email: row.email,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt
      }));
      const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number };
      return {
        table: safeTable,
        count: Number(countRow.count || 0),
        rows
      };
    }

    if (safeTable === 'site_access') {
      const rows = this.db
        .prepare(
          `SELECT
            sa.user_id AS userId,
            u.email,
            sa.site_slug AS siteSlug,
            sa.role,
            sa.created_at AS createdAt
           FROM site_access sa
           INNER JOIN users u ON u.id = sa.user_id
           ORDER BY sa.created_at DESC
           LIMIT ?`
        )
        .all(safeLimit) as Array<Record<string, string | number>>;
      const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM site_access').get() as { count: number };
      return {
        table: safeTable,
        count: Number(countRow.count || 0),
        rows
      };
    }

    if (safeTable === 'site_settings') {
      const rows = this.db
        .prepare(
          `SELECT
            site_slug AS siteSlug,
            publishing_enabled AS publishingEnabled,
            max_publishes_per_run AS maxPublishesPerRun,
            ad_slots_enabled AS adSlotsEnabled,
            ads_mode AS adsMode,
            ads_preview_enabled AS adsPreviewEnabled,
            adsense_publisher_id AS adsensePublisherId,
            adsense_slot_header AS slotHeader,
            adsense_slot_in_content AS slotInContent,
            adsense_slot_footer AS slotFooter,
            fallback_to_platform AS fallbackToPlatform,
            studio_url AS studioUrl,
            updated_at AS updatedAt
           FROM site_settings
           ORDER BY updated_at DESC
           LIMIT ?`
        )
        .all(safeLimit) as Array<Record<string, string | number>>;
      const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM site_settings').get() as { count: number };
      return {
        table: safeTable,
        count: Number(countRow.count || 0),
        rows
      };
    }

    if (safeTable === 'entitlements') {
      const rows = this.db
        .prepare(
          `SELECT
            site_slug AS siteSlug,
            plan,
            monthly_quota AS monthlyQuota,
            published_this_month AS publishedThisMonth,
            period_start AS periodStart,
            period_end AS periodEnd,
            status,
            stripe_customer_id AS stripeCustomerId,
            stripe_subscription_id AS stripeSubscriptionId,
            stripe_price_id AS stripePriceId,
            billing_status AS billingStatus,
            updated_at AS updatedAt
           FROM entitlements
           ORDER BY updated_at DESC
           LIMIT ?`
        )
        .all(safeLimit) as Array<Record<string, string | number>>;
      const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM entitlements').get() as { count: number };
      return {
        table: safeTable,
        count: Number(countRow.count || 0),
        rows
      };
    }

    if (safeTable === 'published_article_events') {
      const rows = this.db
        .prepare(
          `SELECT
            site_slug AS siteSlug,
            article_id AS articleId,
            increment_by AS incrementBy,
            counted_at AS countedAt
           FROM published_article_events
           ORDER BY counted_at DESC
           LIMIT ?`
        )
        .all(safeLimit) as Array<Record<string, string | number>>;
      const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM published_article_events').get() as {
        count: number;
      };
      return {
        table: safeTable,
        count: Number(countRow.count || 0),
        rows
      };
    }

    const rows = this.db
      .prepare(
        `SELECT
          event_id AS eventId,
          received_at AS receivedAt
         FROM processed_webhook_events
         ORDER BY received_at DESC
         LIMIT ?`
      )
      .all(safeLimit) as Array<Record<string, string | number>>;
    const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM processed_webhook_events').get() as {
      count: number;
    };
    return {
      table: safeTable,
      count: Number(countRow.count || 0),
      rows
    };
  }
}
