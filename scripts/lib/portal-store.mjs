import crypto from 'node:crypto';
import postgres from 'postgres';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSiteSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeBillingMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'customer_paid' || raw === 'incubating' || raw === 'complimentary') return raw;
  return 'incubating';
}

function normalizeEntitlementStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'paused' || raw === 'stopped' || raw === 'active') return raw;
  return 'active';
}

function normalizeBillingStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'trial' || raw === 'active' || raw === 'overdue' || raw === 'canceled' || raw === 'n/a') return raw;
  return 'n/a';
}

function getCurrentMonthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    periodStartIso: start.toISOString(),
    periodEndIso: end.toISOString()
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export async function ensurePostgresPortalSchema(sql) {
  const statements = [
    `DO $$
    BEGIN
      CREATE TYPE portal_entitlement_status AS ENUM ('active', 'paused', 'stopped');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$`,
    `DO $$
    BEGIN
      CREATE TYPE portal_billing_mode AS ENUM ('customer_paid', 'incubating', 'complimentary');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$`,
    `DO $$
    BEGIN
      CREATE TYPE portal_billing_status AS ENUM ('n/a', 'trial', 'active', 'overdue', 'canceled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$`,
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
      public_contact_email TEXT NOT NULL DEFAULT '',
      privacy_policy_override TEXT NOT NULL DEFAULT '',
      cookie_policy_override TEXT NOT NULL DEFAULT '',
      disclaimer_override TEXT NOT NULL DEFAULT '',
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
      status portal_entitlement_status NOT NULL DEFAULT 'active',
      stripe_customer_id TEXT NOT NULL DEFAULT '',
      stripe_subscription_id TEXT NOT NULL DEFAULT '',
      stripe_price_id TEXT NOT NULL DEFAULT '',
      billing_mode portal_billing_mode NOT NULL DEFAULT 'incubating',
      billing_status portal_billing_status NOT NULL DEFAULT 'trial',
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
    `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS public_contact_email TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS privacy_policy_override TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cookie_policy_override TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS disclaimer_override TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_plan TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_monthly_quota INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_effective_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS pending_stripe_price_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS billing_mode portal_billing_mode NOT NULL DEFAULT 'incubating'`,
    `ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS billing_status portal_billing_status NOT NULL DEFAULT 'trial'`,
    `ALTER TABLE entitlements ALTER COLUMN status DROP DEFAULT`,
    `ALTER TABLE entitlements ALTER COLUMN status TYPE portal_entitlement_status USING (
      CASE
        WHEN status IN ('active', 'paused', 'stopped') THEN status::portal_entitlement_status
        ELSE 'active'::portal_entitlement_status
      END
    )`,
    `ALTER TABLE entitlements ALTER COLUMN status SET DEFAULT 'active'`,
    `ALTER TABLE entitlements ALTER COLUMN billing_mode DROP DEFAULT`,
    `ALTER TABLE entitlements ALTER COLUMN billing_mode TYPE portal_billing_mode USING (
      CASE
        WHEN billing_mode IN ('customer_paid', 'incubating', 'complimentary') THEN billing_mode::portal_billing_mode
        ELSE 'incubating'::portal_billing_mode
      END
    )`,
    `ALTER TABLE entitlements ALTER COLUMN billing_mode SET DEFAULT 'incubating'`,
    `ALTER TABLE entitlements ALTER COLUMN billing_status DROP DEFAULT`,
    `ALTER TABLE entitlements ALTER COLUMN billing_status TYPE portal_billing_status USING (
      CASE
        WHEN billing_status IN ('n/a', 'trial', 'active', 'overdue', 'canceled') THEN billing_status::portal_billing_status
        ELSE 'n/a'::portal_billing_status
      END
    )`,
    `ALTER TABLE entitlements ALTER COLUMN billing_status SET DEFAULT 'trial'`
  ];

  for (const statement of statements) {
    await sql.unsafe(statement);
  }
}

async function createPostgresPortalStore(postgresUrl) {
  const sql = postgres(postgresUrl, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {}
  });
  await ensurePostgresPortalSchema(sql);

  async function ensureSiteRecords(siteSlug) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    if (!normalizedSlug) return;
    const now = nowIso();
    const window = getCurrentMonthWindow();
    await sql.begin(async (tx) => {
      await tx.unsafe(
        `INSERT INTO site_settings (
          site_slug, publishing_enabled, max_publishes_per_run, ad_slots_enabled,
          ads_mode, ads_preview_enabled, adsense_publisher_id, adsense_slot_header,
          adsense_slot_in_content, adsense_slot_footer, fallback_to_platform, studio_url, updated_at
        ) VALUES ($1, TRUE, 1, FALSE, 'auto', TRUE, '', '', '', '', TRUE, '', $2)
        ON CONFLICT(site_slug) DO NOTHING`,
        [normalizedSlug, now]
      );
      await tx.unsafe(
        `INSERT INTO entitlements (
          site_slug, plan, monthly_quota, published_this_month, period_start, period_end,
          status, stripe_customer_id, stripe_subscription_id, stripe_price_id, billing_mode, billing_status, updated_at
        ) VALUES ($1, 'base', 3, 0, $2, $3, 'active', '', '', '', 'incubating', 'n/a', $4)
        ON CONFLICT(site_slug) DO NOTHING`,
        [normalizedSlug, window.periodStartIso, window.periodEndIso, now]
      );
    });
  }

  return {
    provider: 'postgres',
    async close() {
      await sql.end();
    },
    async ensureSiteRecords(siteSlug) {
      return ensureSiteRecords(siteSlug);
    },
    async createOrUpdateUser(email, password) {
      const normalizedEmail = normalizeEmail(email);
      const now = nowIso();
      const passwordHash = hashPassword(password);
      const rows = await sql.unsafe(
        `INSERT INTO users (email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at
         RETURNING id, email, xmax = 0 AS inserted`,
        [normalizedEmail, passwordHash, now, now]
      );
      const row = rows[0];
      if (!row) throw new Error('Failed to create or update portal user');
      return {
        id: Number(row.id),
        email: row.email,
        created: Boolean(row.inserted),
        passwordUpdated: true
      };
    },
    async assignSiteAccess(userId, siteSlug, role) {
      const normalizedSlug = normalizeSiteSlug(siteSlug);
      if (!normalizedSlug) return;
      await ensureSiteRecords(normalizedSlug);
      await sql.unsafe(
        `INSERT INTO site_access (user_id, site_slug, role, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, site_slug) DO UPDATE SET role = EXCLUDED.role`,
        [userId, normalizedSlug, role, nowIso()]
      );
    },
    async patchEntitlement(siteSlug, patch = {}) {
      const normalizedSlug = normalizeSiteSlug(siteSlug);
      if (!normalizedSlug) return null;
      await ensureSiteRecords(normalizedSlug);
      const rows = await sql.unsafe(
        `SELECT site_slug AS "siteSlug", plan, monthly_quota AS "monthlyQuota", published_this_month AS "publishedThisMonth",
                period_start AS "periodStart", period_end AS "periodEnd", pending_plan AS "pendingPlan",
                pending_monthly_quota AS "pendingMonthlyQuota", pending_effective_at AS "pendingEffectiveAt",
                pending_stripe_price_id AS "pendingStripePriceId", status, stripe_customer_id AS "stripeCustomerId",
                stripe_subscription_id AS "stripeSubscriptionId", stripe_price_id AS "stripePriceId",
                billing_mode AS "billingMode", billing_status AS "billingStatus"
         FROM entitlements
         WHERE site_slug = $1
         LIMIT 1`,
        [normalizedSlug]
      );
      const current = rows[0];
      if (!current) return null;
      const next = {
        ...current,
        ...patch,
        billingMode: normalizeBillingMode(patch.billingMode ?? current.billingMode),
        billingStatus: normalizeBillingStatus(patch.billingStatus ?? current.billingStatus),
        status: normalizeEntitlementStatus(patch.status ?? current.status),
        updatedAt: nowIso()
      };
      await sql.unsafe(
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
             billing_mode = $14,
             billing_status = $15,
             updated_at = $16
         WHERE site_slug = $17`,
        [
          next.plan,
          Number(next.monthlyQuota || 0),
          Number(next.publishedThisMonth || 0),
          next.periodStart,
          next.periodEnd,
          next.pendingPlan || '',
          Number(next.pendingMonthlyQuota || 0),
          next.pendingEffectiveAt || '',
          next.pendingStripePriceId || '',
          next.status,
          next.stripeCustomerId || '',
          next.stripeSubscriptionId || '',
          next.stripePriceId || '',
          next.billingMode,
          next.billingStatus,
          next.updatedAt,
          normalizedSlug
        ]
      );
      return next;
    },
    async getSiteSettings(siteSlug) {
      const normalizedSlug = normalizeSiteSlug(siteSlug);
      if (!normalizedSlug) return null;
      await ensureSiteRecords(normalizedSlug);
      const rows = await sql.unsafe(
        `SELECT site_slug AS "siteSlug",
                publishing_enabled AS "publishingEnabled",
                max_publishes_per_run AS "maxPublishesPerRun",
                ad_slots_enabled AS "adSlotsEnabled",
                ads_mode AS "adsMode",
                ads_preview_enabled AS "adsPreviewEnabled",
                adsense_publisher_id AS "adsensePublisherId",
                adsense_slot_header AS "adsenseSlotHeader",
                adsense_slot_in_content AS "adsenseSlotInContent",
                adsense_slot_footer AS "adsenseSlotFooter",
                fallback_to_platform AS "fallbackToPlatform",
                studio_url AS "studioUrl",
                public_contact_email AS "publicContactEmail",
                privacy_policy_override AS "privacyPolicyOverride",
                cookie_policy_override AS "cookiePolicyOverride",
                disclaimer_override AS "disclaimerOverride",
                updated_at AS "updatedAt"
         FROM site_settings
         WHERE site_slug = $1
         LIMIT 1`,
        [normalizedSlug]
      );
      return rows[0] || null;
    },
    async patchSiteSettings(siteSlug, patch = {}) {
      const normalizedSlug = normalizeSiteSlug(siteSlug);
      if (!normalizedSlug) return null;
      await ensureSiteRecords(normalizedSlug);
      const current = await this.getSiteSettings(normalizedSlug);
      if (!current) return null;
      const next = {
        ...current,
        ...patch,
        updatedAt: nowIso()
      };
      await sql.unsafe(
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
             public_contact_email = $12,
             privacy_policy_override = $13,
             cookie_policy_override = $14,
             disclaimer_override = $15,
             updated_at = $16
         WHERE site_slug = $17`,
        [
          Boolean(next.publishingEnabled),
          Math.max(1, Number(next.maxPublishesPerRun || 1)),
          Boolean(next.adSlotsEnabled),
          String(next.adsMode || 'auto').trim() || 'auto',
          Boolean(next.adsPreviewEnabled),
          String(next.adsensePublisherId || '').trim(),
          String(next.adsenseSlotHeader || '').trim(),
          String(next.adsenseSlotInContent || '').trim(),
          String(next.adsenseSlotFooter || '').trim(),
          Boolean(next.fallbackToPlatform),
          String(next.studioUrl || '').trim(),
          String(next.publicContactEmail || '').trim(),
          String(next.privacyPolicyOverride || '').trim(),
          String(next.cookiePolicyOverride || '').trim(),
          String(next.disclaimerOverride || '').trim(),
          String(next.updatedAt || nowIso()),
          normalizedSlug
        ]
      );
      return this.getSiteSettings(normalizedSlug);
    },
    async listSiteAccess(siteSlug) {
      const normalizedSlug = normalizeSiteSlug(siteSlug);
      return sql.unsafe(
        `SELECT sa.user_id AS "userId", sa.site_slug AS "siteSlug", sa.role AS role, u.email AS email
         FROM site_access sa
         INNER JOIN users u ON u.id = sa.user_id
         WHERE sa.site_slug = $1
         ORDER BY sa.role DESC, u.email ASC`,
        [normalizedSlug]
      );
    },
    async revokeOtherOwners(siteSlug, keepEmails = []) {
      const normalizedSlug = normalizeSiteSlug(siteSlug);
      const keep = new Set(keepEmails.map((item) => normalizeEmail(item)).filter(Boolean));
      const owners = await sql.unsafe(
        `SELECT sa.user_id AS "userId", u.email AS email
         FROM site_access sa
         INNER JOIN users u ON u.id = sa.user_id
         WHERE sa.site_slug = $1 AND sa.role = 'owner'`,
        [normalizedSlug]
      );
      const revoked = [];
      for (const owner of owners) {
        const email = normalizeEmail(owner.email);
        if (keep.has(email)) continue;
        await sql.unsafe('DELETE FROM site_access WHERE user_id = $1 AND site_slug = $2', [owner.userId, normalizedSlug]);
        revoked.push(email);
      }
      return revoked;
    }
  };
}

export async function createPortalStore({
  postgresUrl = process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL || ''
} = {}) {
  const connectionString = String(postgresUrl || '').trim();
  if (!connectionString) {
    throw new Error('PORTAL_DATABASE_URL (or DATABASE_URL) is required for the portal store');
  }
  return createPostgresPortalStore(connectionString);
}
