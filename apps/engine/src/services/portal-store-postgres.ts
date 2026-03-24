import crypto from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { getCurrentMonthWindow, getQuotaForPlan, isIsoBefore, normalizePlan } from '../config/plans';
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
import type { PortalStoreAdapter } from './portal-store-adapter';

function isoNow() {
  return new Date().toISOString();
}

function normalizeSiteSlug(siteSlug: string) {
  return String(siteSlug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type UserRow = {
  id: number;
  email: string;
  password_hash?: string;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  token: string;
  user_id: number;
  expires_at: string;
  created_at: string;
  email: string;
  user_created_at: string;
  user_updated_at: string;
};

type SiteSettingsRow = {
  site_slug: string;
  publishing_enabled: boolean;
  max_publishes_per_run: number;
  ad_slots_enabled: boolean;
  ads_mode: string;
  ads_preview_enabled: boolean;
  adsense_publisher_id: string;
  adsense_slot_header: string;
  adsense_slot_in_content: string;
  adsense_slot_footer: string;
  fallback_to_platform: boolean;
  studio_url: string;
  updated_at: string;
};

type EntitlementRow = {
  site_slug: string;
  plan: string;
  monthly_quota: number;
  published_this_month: number;
  period_start: string;
  period_end: string;
  pending_plan: string;
  pending_monthly_quota: number;
  pending_effective_at: string;
  pending_stripe_price_id: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  billing_status: string;
  updated_at: string;
};

function asSiteSettings(row: SiteSettingsRow): PortalSiteSettings {
  return {
    siteSlug: row.site_slug,
    publishingEnabled: Boolean(row.publishing_enabled),
    maxPublishesPerRun: Number(row.max_publishes_per_run || 1),
    adSlotsEnabled: Boolean(row.ad_slots_enabled),
    adsMode:
      (row.ads_mode === 'manual' || row.ads_mode === 'hybrid' || row.ads_mode === 'auto' ? row.ads_mode : 'auto') as PortalSiteSettings['adsMode'],
    adsPreviewEnabled: Boolean(row.ads_preview_enabled),
    adsensePublisherId: row.adsense_publisher_id || '',
    adsenseSlotHeader: row.adsense_slot_header || '',
    adsenseSlotInContent: row.adsense_slot_in_content || '',
    adsenseSlotFooter: row.adsense_slot_footer || '',
    fallbackToPlatform: Boolean(row.fallback_to_platform),
    studioUrl: row.studio_url || '',
    updatedAt: row.updated_at
  };
}

function asEntitlement(row: EntitlementRow): PortalSiteEntitlement {
  const plan = normalizePlan(row.plan);
  const pendingPlanRaw = String(row.pending_plan || '').trim();
  const pendingPlan = (pendingPlanRaw === 'base' || pendingPlanRaw === 'standard' || pendingPlanRaw === 'pro'
    ? pendingPlanRaw
    : '') as PortalSiteEntitlement['pendingPlan'];
  return {
    siteSlug: row.site_slug,
    plan,
    monthlyQuota: Number(row.monthly_quota || getQuotaForPlan(plan)),
    publishedThisMonth: Number(row.published_this_month || 0),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    pendingPlan,
    pendingMonthlyQuota: Math.max(0, Number(row.pending_monthly_quota || 0)),
    pendingEffectiveAt: String(row.pending_effective_at || ''),
    pendingStripePriceId: String(row.pending_stripe_price_id || ''),
    status: (row.status === 'paused' || row.status === 'stopped' ? row.status : 'active') as PortalSiteEntitlement['status'],
    stripeCustomerId: row.stripe_customer_id || '',
    stripeSubscriptionId: row.stripe_subscription_id || '',
    stripePriceId: row.stripe_price_id || '',
    billingStatus:
      row.billing_status === 'active' ||
      row.billing_status === 'overdue' ||
      row.billing_status === 'canceled' ||
      row.billing_status === 'trial'
        ? row.billing_status
        : 'n/a' as PortalSiteEntitlement['billingStatus'],
    updatedAt: row.updated_at
  };
}

export class PostgresPortalStore implements PortalStoreAdapter {
  private readonly sql: Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }

  async init() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        used_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at)`,
      `CREATE TABLE IF NOT EXISTS site_access (
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        site_slug TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'owner',
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, site_slug)
      )`,
      `CREATE TABLE IF NOT EXISTS site_settings (
        site_slug TEXT PRIMARY KEY,
        publishing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        max_publishes_per_run INTEGER NOT NULL DEFAULT 1,
        ad_slots_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ads_mode TEXT NOT NULL DEFAULT 'auto',
        ads_preview_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        adsense_publisher_id TEXT NOT NULL DEFAULT '',
        adsense_slot_header TEXT NOT NULL DEFAULT '',
        adsense_slot_in_content TEXT NOT NULL DEFAULT '',
        adsense_slot_footer TEXT NOT NULL DEFAULT '',
        fallback_to_platform BOOLEAN NOT NULL DEFAULT TRUE,
        studio_url TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS entitlements (
        site_slug TEXT PRIMARY KEY,
        plan TEXT NOT NULL DEFAULT 'base',
        monthly_quota INTEGER NOT NULL DEFAULT 3,
        published_this_month INTEGER NOT NULL DEFAULT 0,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        pending_plan TEXT NOT NULL DEFAULT '',
        pending_monthly_quota INTEGER NOT NULL DEFAULT 0,
        pending_effective_at TEXT NOT NULL DEFAULT '',
        pending_stripe_price_id TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        stripe_customer_id TEXT NOT NULL DEFAULT '',
        stripe_subscription_id TEXT NOT NULL DEFAULT '',
        stripe_price_id TEXT NOT NULL DEFAULT '',
        billing_status TEXT NOT NULL DEFAULT 'trial',
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS processed_webhook_events (
        event_id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS published_article_events (
        site_slug TEXT NOT NULL,
        article_id TEXT NOT NULL,
        increment_by INTEGER NOT NULL DEFAULT 1,
        counted_at TEXT NOT NULL,
        PRIMARY KEY (site_slug, article_id)
      )`,
      `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ads_mode TEXT NOT NULL DEFAULT 'auto'`,
      `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ads_preview_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_plan TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_monthly_quota INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_effective_at TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_stripe_price_id TEXT NOT NULL DEFAULT ''`
    ];

    for (const statement of statements) {
      await this.sql.unsafe(statement);
    }
  }

  async close() {
    await this.sql.end();
  }

  async createOrUpdateUser(email: string, passwordHash: string): Promise<PortalUser> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const now = isoNow();
    const rows = await this.sql.unsafe<UserRow[]>(
      `INSERT INTO users (email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at
       RETURNING id, email, created_at, updated_at`,
      [normalizedEmail, passwordHash, now, now]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Failed to create or update portal user in Postgres');
    }
    return {
      id: Number(row.id),
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getUserWithPasswordHashByEmail(email: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rows = await this.sql.unsafe<UserRow[]>(
      `SELECT id, email, password_hash, created_at, updated_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      user: {
        id: Number(row.id),
        email: row.email,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      passwordHash: String(row.password_hash || '')
    };
  }

  async getUserById(userId: number) {
    const rows = await this.sql.unsafe<UserRow[]>(
      `SELECT id, email, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createSession(userId: number, ttlSeconds = 60 * 60 * 24 * 14): Promise<PortalSession> {
    const createdAt = isoNow();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await this.sql.unsafe(
      `INSERT INTO sessions (token, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [token, userId, expiresAt, createdAt]
    );
    return { token, userId, expiresAt, createdAt };
  }

  async getSession(token: string) {
    const rows = await this.sql.unsafe<SessionRow[]>(
      `SELECT s.token, s.user_id, s.expires_at, s.created_at,
              u.email, u.created_at AS user_created_at, u.updated_at AS user_updated_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
       LIMIT 1`,
      [token]
    );
    const row = rows[0];
    if (!row) return null;
    const nowIso = isoNow();
    if (!isIsoBefore(nowIso, row.expires_at)) {
      await this.revokeSession(token);
      return null;
    }
    return {
      session: {
        token: row.token,
        userId: Number(row.user_id),
        expiresAt: row.expires_at,
        createdAt: row.created_at
      },
      user: {
        id: Number(row.user_id),
        email: row.email,
        createdAt: row.user_created_at,
        updatedAt: row.user_updated_at
      }
    };
  }

  async revokeSession(token: string) {
    await this.sql.unsafe('DELETE FROM sessions WHERE token = $1', [token]);
  }

  private async cleanupPasswordResetTokens(nowIso = isoNow()) {
    await this.sql.unsafe(
      'DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at <= $1',
      [nowIso]
    );
  }

  async createPasswordResetToken(userId: number, tokenHash: string, ttlSeconds = 60 * 30) {
    const now = isoNow();
    const expiresAt = new Date(Date.now() + Math.max(60, Number(ttlSeconds || 0)) * 1000).toISOString();
    await this.cleanupPasswordResetTokens(now);
    await this.sql.begin(async (tx) => {
      await tx.unsafe('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
      await tx.unsafe(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at, used_at)
         VALUES ($1, $2, $3, $4, NULL)`,
        [tokenHash, userId, expiresAt, now]
      );
    });
    return { tokenHash, userId, expiresAt, createdAt: now };
  }

  async consumePasswordResetToken(tokenHash: string, nextPasswordHash: string) {
    const now = isoNow();
    await this.cleanupPasswordResetTokens(now);

    return this.sql.begin(async (tx) => {
      const tokenRows = await tx.unsafe<Array<{ token_hash: string; user_id: number; expires_at: string; used_at: string | null }>>(
        `SELECT token_hash, user_id, expires_at, used_at
         FROM password_reset_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash]
      );
      const tokenRow = tokenRows[0];
      if (!tokenRow) return null;
      if (tokenRow.used_at || !isIsoBefore(now, tokenRow.expires_at)) {
        await tx.unsafe('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
        return null;
      }

      const userRows = await tx.unsafe<UserRow[]>(
        `SELECT id, email, created_at, updated_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [tokenRow.user_id]
      );
      const userRow = userRows[0];
      if (!userRow) {
        await tx.unsafe('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
        return null;
      }

      await tx.unsafe('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [nextPasswordHash, now, tokenRow.user_id]);
      await tx.unsafe('UPDATE password_reset_tokens SET used_at = $1 WHERE token_hash = $2 AND used_at IS NULL', [now, tokenHash]);
      await tx.unsafe('DELETE FROM sessions WHERE user_id = $1', [tokenRow.user_id]);
      await tx.unsafe('DELETE FROM password_reset_tokens WHERE user_id = $1 AND token_hash <> $2', [tokenRow.user_id, tokenHash]);

      return {
        id: Number(userRow.id),
        email: userRow.email,
        createdAt: userRow.created_at,
        updatedAt: now
      } satisfies PortalUser;
    });
  }

  async assignSiteAccess(userId: number, siteSlug: string, role: PortalSiteAccess['role'] = 'owner') {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    if (!normalizedSlug) return;
    await this.ensureSiteRecords(normalizedSlug);
    await this.sql.unsafe(
      `INSERT INTO site_access (user_id, site_slug, role, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, site_slug) DO UPDATE SET role = EXCLUDED.role`,
      [userId, normalizedSlug, role, isoNow()]
    );
  }

  async hasSiteAccess(userId: number, siteSlug: string) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    if (!normalizedSlug) return false;
    const rows = await this.sql.unsafe<Array<{ site_slug: string }>>(
      'SELECT site_slug FROM site_access WHERE user_id = $1 AND site_slug = $2 LIMIT 1',
      [userId, normalizedSlug]
    );
    return Boolean(rows[0]?.site_slug);
  }

  private async ensureSiteRecords(siteSlug: string) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const now = isoNow();
    const window = getCurrentMonthWindow();
    await this.sql.begin(async (tx) => {
      await tx.unsafe(
        `INSERT INTO site_settings (
          site_slug, publishing_enabled, max_publishes_per_run, ad_slots_enabled,
          ads_mode, ads_preview_enabled,
          adsense_publisher_id, adsense_slot_header, adsense_slot_in_content, adsense_slot_footer,
          fallback_to_platform, studio_url, updated_at
        ) VALUES ($1, TRUE, 1, FALSE, 'auto', TRUE, '', '', '', '', TRUE, '', $2)
        ON CONFLICT(site_slug) DO NOTHING`,
        [normalizedSlug, now]
      );

      await tx.unsafe(
        `INSERT INTO entitlements (
          site_slug, plan, monthly_quota, published_this_month, period_start, period_end,
          status, stripe_customer_id, stripe_subscription_id, stripe_price_id, billing_status, updated_at
        ) VALUES ($1, 'base', $2, 0, $3, $4, 'active', '', '', '', 'trial', $5)
        ON CONFLICT(site_slug) DO NOTHING`,
        [normalizedSlug, getQuotaForPlan('base'), window.periodStartIso, window.periodEndIso, now]
      );
    });
  }

  async getSiteSettings(siteSlug: string): Promise<PortalSiteSettings> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    await this.ensureSiteRecords(normalizedSlug);
    const rows = await this.sql.unsafe<SiteSettingsRow[]>(
      `SELECT site_slug, publishing_enabled, max_publishes_per_run, ad_slots_enabled,
              ads_mode, ads_preview_enabled, adsense_publisher_id, adsense_slot_header,
              adsense_slot_in_content, adsense_slot_footer, fallback_to_platform, studio_url, updated_at
       FROM site_settings
       WHERE site_slug = $1
       LIMIT 1`,
      [normalizedSlug]
    );
    const row = rows[0];
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
    return asSiteSettings(row);
  }

  async patchSiteSettings(
    siteSlug: string,
    patch: Partial<Omit<PortalSiteSettings, 'siteSlug' | 'updatedAt'>>
  ): Promise<PortalSiteSettings> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    await this.ensureSiteRecords(normalizedSlug);
    const current = await this.getSiteSettings(normalizedSlug);
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
    await this.sql.unsafe(
      `UPDATE site_settings
       SET publishing_enabled = $1,
           max_publishes_per_run = $2,
           ad_slots_enabled = $3,
           ads_mode = $4,
           ads_preview_enabled = $5,
           adsense_publisher_id = $6,
           adsense_slot_header = $7,
           adsense_slot_in_content = $8,
           adsense_slot_footer = $9,
           fallback_to_platform = $10,
           studio_url = $11,
           updated_at = $12
       WHERE site_slug = $13`,
      [
        next.publishingEnabled,
        Math.max(1, Number(next.maxPublishesPerRun || 1)),
        next.adSlotsEnabled,
        next.adsMode === 'manual' || next.adsMode === 'hybrid' ? next.adsMode : 'auto',
        next.adsPreviewEnabled,
        String(next.adsensePublisherId || '').trim(),
        String(next.adsenseSlotHeader || '').trim(),
        String(next.adsenseSlotInContent || '').trim(),
        String(next.adsenseSlotFooter || '').trim(),
        next.fallbackToPlatform,
        String(next.studioUrl || '').trim(),
        updatedAt,
        normalizedSlug
      ]
    );
    return this.getSiteSettings(normalizedSlug);
  }

  async getEntitlement(siteSlug: string): Promise<PortalSiteEntitlement> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    await this.ensureSiteRecords(normalizedSlug);
    const rows = await this.sql.unsafe<EntitlementRow[]>(
      `SELECT site_slug, plan, monthly_quota, published_this_month, period_start, period_end,
              pending_plan, pending_monthly_quota, pending_effective_at, pending_stripe_price_id,
              status, stripe_customer_id, stripe_subscription_id, stripe_price_id, billing_status, updated_at
       FROM entitlements
       WHERE site_slug = $1
       LIMIT 1`,
      [normalizedSlug]
    );
    const row = rows[0];
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
        pendingPlan: '',
        pendingMonthlyQuota: 0,
        pendingEffectiveAt: '',
        pendingStripePriceId: '',
        status: 'active',
        stripeCustomerId: '',
        stripeSubscriptionId: '',
        stripePriceId: '',
        billingStatus: 'trial',
        updatedAt: now
      };
    }
    return asEntitlement(row);
  }

  async getEntitlementEffective(siteSlug: string): Promise<PortalSiteEntitlement> {
    return this.maybeResetEntitlementPeriod(siteSlug);
  }

  private async maybeResetEntitlementPeriod(siteSlug: string) {
    const current = await this.getEntitlement(siteSlug);
    const nowIso = isoNow();
    if (isIsoBefore(nowIso, current.periodEnd)) return current;

    const window = getCurrentMonthWindow();
    const applyPendingPlan =
      Boolean(current.pendingPlan) &&
      Boolean(current.pendingEffectiveAt) &&
      !isIsoBefore(nowIso, current.pendingEffectiveAt);

    const nextPlan = applyPendingPlan ? current.pendingPlan : current.plan;
    const nextQuota = applyPendingPlan
      ? Math.max(0, Number(current.pendingMonthlyQuota || getQuotaForPlan((current.pendingPlan || 'base') as PortalSiteEntitlement['plan'])))
      : current.monthlyQuota;
    const nextStripePriceId = applyPendingPlan && current.pendingStripePriceId ? current.pendingStripePriceId : current.stripePriceId;

    await this.sql.unsafe(
      `UPDATE entitlements
       SET plan = $1,
           monthly_quota = $2,
           published_this_month = 0,
           period_start = $3,
           period_end = $4,
           pending_plan = '',
           pending_monthly_quota = 0,
           pending_effective_at = '',
           pending_stripe_price_id = '',
           stripe_price_id = $5,
           updated_at = $6
       WHERE site_slug = $7`,
      [nextPlan, Math.max(0, Number(nextQuota || 0)), window.periodStartIso, window.periodEndIso, nextStripePriceId, nowIso, normalizeSiteSlug(siteSlug)]
    );

    return this.getEntitlement(siteSlug);
  }

  async patchEntitlement(
    siteSlug: string,
    patch: Partial<Omit<PortalSiteEntitlement, 'siteSlug' | 'updatedAt'>>
  ): Promise<PortalSiteEntitlement> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    await this.ensureSiteRecords(normalizedSlug);
    const current = await this.maybeResetEntitlementPeriod(normalizedSlug);
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
      pendingPlan: (
        patch.pendingPlan === '' || patch.pendingPlan === 'base' || patch.pendingPlan === 'standard' || patch.pendingPlan === 'pro'
          ? patch.pendingPlan
          : current.pendingPlan
      ) as PortalSiteEntitlement['pendingPlan'],
      pendingMonthlyQuota: Number(patch.pendingMonthlyQuota ?? current.pendingMonthlyQuota ?? 0),
      pendingEffectiveAt: String(patch.pendingEffectiveAt ?? current.pendingEffectiveAt ?? ''),
      pendingStripePriceId: String(patch.pendingStripePriceId ?? current.pendingStripePriceId ?? ''),
      status: (
        patch.status === 'paused' || patch.status === 'stopped' || patch.status === 'active' ? patch.status : current.status
      ) as PortalSiteEntitlement['status'],
      stripeCustomerId: String(patch.stripeCustomerId ?? current.stripeCustomerId ?? ''),
      stripeSubscriptionId: String(patch.stripeSubscriptionId ?? current.stripeSubscriptionId ?? ''),
      stripePriceId: String(patch.stripePriceId ?? current.stripePriceId ?? ''),
      billingStatus: (
        patch.billingStatus === 'trial' ||
        patch.billingStatus === 'active' ||
        patch.billingStatus === 'overdue' ||
        patch.billingStatus === 'canceled' ||
        patch.billingStatus === 'n/a'
          ? patch.billingStatus
          : current.billingStatus
      ) as PortalSiteEntitlement['billingStatus'],
      updatedAt
    };

    await this.sql.unsafe(
      `UPDATE entitlements
       SET plan = $1,
           monthly_quota = $2,
           published_this_month = $3,
           period_start = $4,
           period_end = $5,
           pending_plan = $6,
           pending_monthly_quota = $7,
           pending_effective_at = $8,
           pending_stripe_price_id = $9,
           status = $10,
           stripe_customer_id = $11,
           stripe_subscription_id = $12,
           stripe_price_id = $13,
           billing_status = $14,
           updated_at = $15
       WHERE site_slug = $16`,
      [
        next.plan,
        Math.max(0, Number(next.monthlyQuota || 0)),
        Math.max(0, Number(next.publishedThisMonth || 0)),
        next.periodStart,
        next.periodEnd,
        next.pendingPlan,
        Math.max(0, Number(next.pendingMonthlyQuota || 0)),
        next.pendingEffectiveAt,
        next.pendingStripePriceId,
        next.status,
        next.stripeCustomerId,
        next.stripeSubscriptionId,
        next.stripePriceId,
        next.billingStatus,
        updatedAt,
        normalizedSlug
      ]
    );

    return this.getEntitlement(normalizedSlug);
  }

  async incrementPublishedCount(siteSlug: string, incrementBy = 1): Promise<PortalSiteEntitlement> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const current = await this.maybeResetEntitlementPeriod(normalizedSlug);
    const nextPublished = Math.max(0, Number(current.publishedThisMonth || 0) + Math.max(0, incrementBy));
    return this.patchEntitlement(normalizedSlug, { publishedThisMonth: nextPublished });
  }

  async incrementPublishedCountIdempotent(
    siteSlug: string,
    articleId: string,
    incrementBy = 1
  ): Promise<{ counted: boolean; reason: string; entitlement: PortalSiteEntitlement }> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const normalizedArticleId = String(articleId || '').trim();
    if (!normalizedSlug || !normalizedArticleId) {
      return {
        counted: false,
        reason: 'missing_site_or_article',
        entitlement: await this.getEntitlement(normalizedSlug || siteSlug)
      };
    }

    await this.ensureSiteRecords(normalizedSlug);
    const rows = await this.sql.unsafe<Array<{ article_id: string }>>(
      `INSERT INTO published_article_events (site_slug, article_id, increment_by, counted_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (site_slug, article_id) DO NOTHING
       RETURNING article_id`,
      [normalizedSlug, normalizedArticleId, Math.max(1, Number(incrementBy || 1)), isoNow()]
    );

    if (!rows[0]) {
      return {
        counted: false,
        reason: 'already_counted',
        entitlement: await this.getEntitlement(normalizedSlug)
      };
    }

    return {
      counted: true,
      reason: 'counted',
      entitlement: await this.incrementPublishedCount(normalizedSlug, incrementBy)
    };
  }

  async listSitesForUser(userId: number): Promise<PortalSiteSummary[]> {
    const rows = await this.sql.unsafe<Array<{ site_slug: string; role: PortalSiteAccess['role'] }>>(
      `SELECT site_slug, role
       FROM site_access
       WHERE user_id = $1
       ORDER BY site_slug ASC`,
      [userId]
    );

    return Promise.all(
      rows.map(async (row) => {
        const siteSlug = normalizeSiteSlug(row.site_slug);
        return {
          siteSlug,
          role: row.role,
          settings: await this.getSiteSettings(siteSlug),
          entitlement: await this.getEntitlementEffective(siteSlug)
        } satisfies PortalSiteSummary;
      })
    );
  }

  async getSiteSummaryForUser(userId: number, siteSlug: string): Promise<PortalSiteSummary | null> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    if (!(await this.hasSiteAccess(userId, normalizedSlug))) return null;
    const rows = await this.sql.unsafe<Array<{ role: PortalSiteAccess['role'] }>>(
      'SELECT role FROM site_access WHERE user_id = $1 AND site_slug = $2 LIMIT 1',
      [userId, normalizedSlug]
    );
    return {
      siteSlug: normalizedSlug,
      role: rows[0]?.role || 'viewer',
      settings: await this.getSiteSettings(normalizedSlug),
      entitlement: await this.getEntitlementEffective(normalizedSlug)
    };
  }

  async isWebhookEventProcessed(eventId: string) {
    const rows = await this.sql.unsafe<Array<{ event_id: string }>>(
      'SELECT event_id FROM processed_webhook_events WHERE event_id = $1 LIMIT 1',
      [eventId]
    );
    return Boolean(rows[0]?.event_id);
  }

  async markWebhookEventProcessed(eventId: string) {
    if (!eventId) return;
    await this.sql.unsafe(
      `INSERT INTO processed_webhook_events (event_id, received_at)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, isoNow()]
    );
  }

  listAdminDbTables(): PortalAdminDbTable[] {
    return [
      'users',
      'sessions',
      'password_reset_tokens',
      'site_access',
      'site_settings',
      'entitlements',
      'processed_webhook_events',
      'published_article_events'
    ];
  }

  async getAdminDbTableSnapshot(table: PortalAdminDbTable, limit = 100): Promise<PortalAdminDbTableSnapshot> {
    const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
    const safeTable: PortalAdminDbTable = this.listAdminDbTables().includes(table) ? table : 'users';

    if (safeTable === 'users') {
      const rows = await this.sql.unsafe<Array<Record<string, string | number>>>(
        `SELECT id, email, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM users
         ORDER BY id DESC
         LIMIT $1`,
        [safeLimit]
      );
      const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM users');
      return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
    }

    if (safeTable === 'sessions') {
      const rowsRaw = await this.sql.unsafe<Array<{ token: string; userid: number; email: string; expiresat: string; createdat: string }>>(
        `SELECT s.token, s.user_id AS userId, u.email, s.expires_at AS expiresAt, s.created_at AS createdAt
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         ORDER BY s.created_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      const rows = rowsRaw.map((row) => ({
        tokenPreview: row.token ? `${row.token.slice(0, 8)}...${row.token.slice(-4)}` : '',
        userId: Number((row as any).userId ?? row.userid),
        email: row.email,
        expiresAt: (row as any).expiresAt ?? row.expiresat,
        createdAt: (row as any).createdAt ?? row.createdat
      }));
      const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM sessions');
      return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
    }

    if (safeTable === 'password_reset_tokens') {
      const rowsRaw = await this.sql.unsafe<Array<{ tokenhash: string; userid: number; email: string; expiresat: string; createdat: string; usedat: string | null }>>(
        `SELECT prt.token_hash AS tokenHash, prt.user_id AS userId, u.email,
                prt.expires_at AS expiresAt, prt.created_at AS createdAt, prt.used_at AS usedAt
         FROM password_reset_tokens prt
         INNER JOIN users u ON u.id = prt.user_id
         ORDER BY prt.created_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      const rows = rowsRaw.map((row) => ({
        tokenPreview: ((row as any).tokenHash ?? row.tokenhash) ? `${String((row as any).tokenHash ?? row.tokenhash).slice(0, 8)}...${String((row as any).tokenHash ?? row.tokenhash).slice(-4)}` : '',
        userId: Number((row as any).userId ?? row.userid),
        email: row.email,
        expiresAt: (row as any).expiresAt ?? row.expiresat,
        createdAt: (row as any).createdAt ?? row.createdat,
        usedAt: (row as any).usedAt ?? row.usedat
      }));
      const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM password_reset_tokens');
      return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
    }

    if (safeTable === 'site_access') {
      const rows = await this.sql.unsafe<Array<Record<string, string | number>>>(
        `SELECT sa.user_id AS "userId", u.email, sa.site_slug AS "siteSlug", sa.role, sa.created_at AS "createdAt"
         FROM site_access sa
         INNER JOIN users u ON u.id = sa.user_id
         ORDER BY sa.created_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM site_access');
      return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
    }

    if (safeTable === 'site_settings') {
      const rows = await this.sql.unsafe<Array<Record<string, string | number | boolean>>>(
        `SELECT site_slug AS "siteSlug", publishing_enabled AS "publishingEnabled", max_publishes_per_run AS "maxPublishesPerRun",
                ad_slots_enabled AS "adSlotsEnabled", ads_mode AS "adsMode", ads_preview_enabled AS "adsPreviewEnabled",
                adsense_publisher_id AS "adsensePublisherId", adsense_slot_header AS "slotHeader",
                adsense_slot_in_content AS "slotInContent", adsense_slot_footer AS "slotFooter",
                fallback_to_platform AS "fallbackToPlatform", studio_url AS "studioUrl", updated_at AS "updatedAt"
         FROM site_settings
         ORDER BY updated_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM site_settings');
      return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
    }

    if (safeTable === 'entitlements') {
      const rows = await this.sql.unsafe<Array<Record<string, string | number>>>(
        `SELECT site_slug AS "siteSlug", plan, monthly_quota AS "monthlyQuota", published_this_month AS "publishedThisMonth",
                period_start AS "periodStart", period_end AS "periodEnd", pending_plan AS "pendingPlan",
                pending_monthly_quota AS "pendingMonthlyQuota", pending_effective_at AS "pendingEffectiveAt",
                pending_stripe_price_id AS "pendingStripePriceId", status, stripe_customer_id AS "stripeCustomerId",
                stripe_subscription_id AS "stripeSubscriptionId", stripe_price_id AS "stripePriceId",
                billing_status AS "billingStatus", updated_at AS "updatedAt"
         FROM entitlements
         ORDER BY updated_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM entitlements');
      return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
    }

    if (safeTable === 'published_article_events') {
      const rows = await this.sql.unsafe<Array<Record<string, string | number>>>(
        `SELECT site_slug AS "siteSlug", article_id AS "articleId", increment_by AS "incrementBy", counted_at AS "countedAt"
         FROM published_article_events
         ORDER BY counted_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM published_article_events');
      return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
    }

    const rows = await this.sql.unsafe<Array<Record<string, string | number>>>(
      `SELECT event_id AS "eventId", received_at AS "receivedAt"
       FROM processed_webhook_events
       ORDER BY received_at DESC
       LIMIT $1`,
      [safeLimit]
    );
    const countRow = await this.sql.unsafe<Array<{ count: string | number }>>('SELECT COUNT(*) AS count FROM processed_webhook_events');
    return { table: safeTable, count: Number(countRow[0]?.count || 0), rows };
  }
}
