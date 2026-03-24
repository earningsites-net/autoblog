#!/usr/bin/env node
import './load-local-env.mjs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { resolveRuntimePaths } from './lib/runtime-paths.mjs';
import { ensurePostgresPortalSchema } from './lib/portal-store.mjs';

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};
  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    const key = token.slice(2);
    const value = args[0] && !args[0].startsWith('--') ? args.shift() : 'true';
    flags[key] = value;
  }
  return flags;
}

function printUsage() {
  console.log(
    'Usage: node scripts/portal-store-migrate.mjs [--source-sqlite <path>] --target-url <postgres-url> [--fail-if-missing-source true|false]'
  );
}

function asBool(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function resolveSourceSqlitePath(flags) {
  const runtimePaths = resolveRuntimePaths({ workspaceRoot: WORKSPACE_ROOT, env: process.env });
  const configured = String(flags['source-sqlite'] || process.env.PORTAL_MIGRATE_SOURCE_SQLITE || runtimePaths.portalDbPath).trim();
  return path.isAbsolute(configured) ? configured : path.resolve(WORKSPACE_ROOT, configured);
}

function getTargetUrl(flags) {
  return String(flags['target-url'] || process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL || '').trim();
}

function describeDatabaseUrl(value) {
  try {
    const parsed = new URL(value);
    const username = parsed.username ? `${parsed.username}@` : '';
    const database = parsed.pathname.replace(/^\//, '') || '(default)';
    return `${parsed.protocol}//${username}${parsed.hostname}:${parsed.port || '5432'}/${database}`;
  } catch {
    return '(invalid-url)';
  }
}

function tableExists(db, tableName) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`)
    .get(tableName);
  return Boolean(row?.name);
}

function readRows(db, tableName, sql) {
  if (!tableExists(db, tableName)) return [];
  return db.prepare(sql).all();
}

function toPgBool(value, defaultValue = false) {
  if (value === null || value === undefined) return defaultValue;
  return Number(value) === 1 || value === true;
}

async function migrateUsers(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO users (id, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
      [Number(row.id), String(row.email || '').trim().toLowerCase(), String(row.password_hash || ''), row.created_at, row.updated_at]
    );
  }

  await sql.unsafe(
    `SELECT setval(
      pg_get_serial_sequence('users', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM users), 1), 1),
      true
    )`
  );
}

async function migrateSessions(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO sessions (token, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           expires_at = EXCLUDED.expires_at,
           created_at = EXCLUDED.created_at`,
      [row.token, Number(row.user_id), row.expires_at, row.created_at]
    );
  }
}

async function migratePasswordResetTokens(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at, used_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token_hash) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           expires_at = EXCLUDED.expires_at,
           created_at = EXCLUDED.created_at,
           used_at = EXCLUDED.used_at`,
      [row.token_hash, Number(row.user_id), row.expires_at, row.created_at, row.used_at || null]
    );
  }
}

async function migrateSiteAccess(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO site_access (user_id, site_slug, role, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, site_slug) DO UPDATE
       SET role = EXCLUDED.role,
           created_at = EXCLUDED.created_at`,
      [Number(row.user_id), String(row.site_slug || '').trim().toLowerCase(), row.role || 'owner', row.created_at]
    );
  }
}

async function migrateSiteSettings(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO site_settings (
         site_slug, publishing_enabled, max_publishes_per_run, ad_slots_enabled,
         ads_mode, ads_preview_enabled, adsense_publisher_id, adsense_slot_header,
         adsense_slot_in_content, adsense_slot_footer, fallback_to_platform, studio_url, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (site_slug) DO UPDATE
       SET publishing_enabled = EXCLUDED.publishing_enabled,
           max_publishes_per_run = EXCLUDED.max_publishes_per_run,
           ad_slots_enabled = EXCLUDED.ad_slots_enabled,
           ads_mode = EXCLUDED.ads_mode,
           ads_preview_enabled = EXCLUDED.ads_preview_enabled,
           adsense_publisher_id = EXCLUDED.adsense_publisher_id,
           adsense_slot_header = EXCLUDED.adsense_slot_header,
           adsense_slot_in_content = EXCLUDED.adsense_slot_in_content,
           adsense_slot_footer = EXCLUDED.adsense_slot_footer,
           fallback_to_platform = EXCLUDED.fallback_to_platform,
           studio_url = EXCLUDED.studio_url,
           updated_at = EXCLUDED.updated_at`,
      [
        String(row.site_slug || '').trim().toLowerCase(),
        toPgBool(row.publishing_enabled, true),
        Math.max(1, Number(row.max_publishes_per_run || 1)),
        toPgBool(row.ad_slots_enabled, false),
        String(row.ads_mode || 'auto'),
        toPgBool(row.ads_preview_enabled, true),
        String(row.adsense_publisher_id || ''),
        String(row.adsense_slot_header || ''),
        String(row.adsense_slot_in_content || ''),
        String(row.adsense_slot_footer || ''),
        toPgBool(row.fallback_to_platform, true),
        String(row.studio_url || ''),
        row.updated_at
      ]
    );
  }
}

async function migrateEntitlements(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO entitlements (
         site_slug, plan, monthly_quota, published_this_month, period_start, period_end,
         pending_plan, pending_monthly_quota, pending_effective_at, pending_stripe_price_id,
         status, stripe_customer_id, stripe_subscription_id, stripe_price_id, billing_status, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (site_slug) DO UPDATE
       SET plan = EXCLUDED.plan,
           monthly_quota = EXCLUDED.monthly_quota,
           published_this_month = EXCLUDED.published_this_month,
           period_start = EXCLUDED.period_start,
           period_end = EXCLUDED.period_end,
           pending_plan = EXCLUDED.pending_plan,
           pending_monthly_quota = EXCLUDED.pending_monthly_quota,
           pending_effective_at = EXCLUDED.pending_effective_at,
           pending_stripe_price_id = EXCLUDED.pending_stripe_price_id,
           status = EXCLUDED.status,
           stripe_customer_id = EXCLUDED.stripe_customer_id,
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           stripe_price_id = EXCLUDED.stripe_price_id,
           billing_status = EXCLUDED.billing_status,
           updated_at = EXCLUDED.updated_at`,
      [
        String(row.site_slug || '').trim().toLowerCase(),
        String(row.plan || 'base'),
        Math.max(0, Number(row.monthly_quota || 0)),
        Math.max(0, Number(row.published_this_month || 0)),
        row.period_start,
        row.period_end,
        String(row.pending_plan || ''),
        Math.max(0, Number(row.pending_monthly_quota || 0)),
        String(row.pending_effective_at || ''),
        String(row.pending_stripe_price_id || ''),
        String(row.status || 'active'),
        String(row.stripe_customer_id || ''),
        String(row.stripe_subscription_id || ''),
        String(row.stripe_price_id || ''),
        String(row.billing_status || 'trial'),
        row.updated_at
      ]
    );
  }
}

async function migrateProcessedWebhookEvents(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO processed_webhook_events (event_id, received_at)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO UPDATE
       SET received_at = EXCLUDED.received_at`,
      [row.event_id, row.received_at]
    );
  }
}

async function migratePublishedArticleEvents(sql, rows) {
  for (const row of rows) {
    await sql.unsafe(
      `INSERT INTO published_article_events (site_slug, article_id, increment_by, counted_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (site_slug, article_id) DO UPDATE
       SET increment_by = EXCLUDED.increment_by,
           counted_at = EXCLUDED.counted_at`,
      [String(row.site_slug || '').trim().toLowerCase(), row.article_id, Math.max(1, Number(row.increment_by || 1)), row.counted_at]
    );
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help !== undefined) {
    printUsage();
    return;
  }
  const sourceSqlitePath = resolveSourceSqlitePath(flags);
  const targetUrl = getTargetUrl(flags);
  const failIfMissingSource = asBool(flags['fail-if-missing-source'], true);

  const sourceDb = new DatabaseSync(sourceSqlitePath);
  const sql = postgres(targetUrl, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {}
  });

  try {
    if (!targetUrl) {
      printUsage();
      throw new Error('Missing PORTAL_DATABASE_URL/DATABASE_URL or --target-url');
    }
    if (!tableExists(sourceDb, 'users') && failIfMissingSource) {
      throw new Error(`Source SQLite DB does not look initialized: ${sourceSqlitePath}`);
    }

    await ensurePostgresPortalSchema(sql);

    const users = readRows(
      sourceDb,
      'users',
      'SELECT id, email, password_hash, created_at, updated_at FROM users ORDER BY id ASC'
    );
    const sessions = readRows(
      sourceDb,
      'sessions',
      'SELECT token, user_id, expires_at, created_at FROM sessions ORDER BY created_at ASC'
    );
    const passwordResetTokens = readRows(
      sourceDb,
      'password_reset_tokens',
      'SELECT token_hash, user_id, expires_at, created_at, used_at FROM password_reset_tokens ORDER BY created_at ASC'
    );
    const siteAccess = readRows(
      sourceDb,
      'site_access',
      'SELECT user_id, site_slug, role, created_at FROM site_access ORDER BY site_slug ASC, user_id ASC'
    );
    const siteSettings = readRows(
      sourceDb,
      'site_settings',
      'SELECT site_slug, publishing_enabled, max_publishes_per_run, ad_slots_enabled, ads_mode, ads_preview_enabled, adsense_publisher_id, adsense_slot_header, adsense_slot_in_content, adsense_slot_footer, fallback_to_platform, studio_url, updated_at FROM site_settings ORDER BY site_slug ASC'
    );
    const entitlements = readRows(
      sourceDb,
      'entitlements',
      'SELECT site_slug, plan, monthly_quota, published_this_month, period_start, period_end, pending_plan, pending_monthly_quota, pending_effective_at, pending_stripe_price_id, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, billing_status, updated_at FROM entitlements ORDER BY site_slug ASC'
    );
    const processedWebhookEvents = readRows(
      sourceDb,
      'processed_webhook_events',
      'SELECT event_id, received_at FROM processed_webhook_events ORDER BY received_at ASC'
    );
    const publishedArticleEvents = readRows(
      sourceDb,
      'published_article_events',
      'SELECT site_slug, article_id, increment_by, counted_at FROM published_article_events ORDER BY counted_at ASC'
    );

    await sql.begin(async (tx) => {
      await migrateUsers(tx, users);
      await migrateSessions(tx, sessions);
      await migratePasswordResetTokens(tx, passwordResetTokens);
      await migrateSiteAccess(tx, siteAccess);
      await migrateSiteSettings(tx, siteSettings);
      await migrateEntitlements(tx, entitlements);
      await migrateProcessedWebhookEvents(tx, processedWebhookEvents);
      await migratePublishedArticleEvents(tx, publishedArticleEvents);
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          sourceSqlitePath,
          target: describeDatabaseUrl(targetUrl),
          counts: {
            users: users.length,
            sessions: sessions.length,
            passwordResetTokens: passwordResetTokens.length,
            siteAccess: siteAccess.length,
            siteSettings: siteSettings.length,
            entitlements: entitlements.length,
            processedWebhookEvents: processedWebhookEvents.length,
            publishedArticleEvents: publishedArticleEvents.length
          }
        },
        null,
        2
      )
    );
  } finally {
    sourceDb.close();
    await sql.end();
  }
}

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error
      ? error.message || JSON.stringify(error, Object.getOwnPropertyNames(error))
      : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
