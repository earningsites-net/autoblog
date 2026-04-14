import './load-local-env';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { z } from 'zod';
import {
  buildDefaultLegalEditableText,
  generationJobRequestSchema,
  type SiteMonetizationSettings
} from '@autoblog/factory-sdk';
import { createWorkflowRunner } from './adapters/workflow-runners';
import { AuthService } from './services/auth-service';
import { BillingService } from './services/billing-service';
import { DefaultEngineService } from './services/engine-service';
import { FactoryOpsService } from './services/factory-ops';
import { InMemoryJobStore } from './services/job-store';
import { comparePlanRank, getCurrentMonthWindow, getQuotaForPlan } from './config/plans';
import { createPortalStore } from './services/portal-store-adapter';
import { LocalSiteRegistry } from './services/site-registry';
import { SiteRuntimeService } from './services/site-runtime-service';
import { isPortalSiteInactiveForOwner, isPortalSiteOperational, type PortalSiteEntitlement } from './services/portal-store-types';

const app = Fastify({ logger: true });
type RawBodyRequest = { rawBody?: string };

app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const raw = typeof body === 'string' ? body : body.toString('utf8');
    (req as typeof req & RawBodyRequest).rawBody = raw;
    done(null, raw ? JSON.parse(raw) : {});
  } catch (error) {
    done(error as Error);
  }
});

const workspaceRoot = process.env.WORKSPACE_ROOT || path.resolve(process.cwd(), '..', '..');
const engineSourceDir = path.dirname(fileURLToPath(import.meta.url));

function readPortalBrandLogoBuffer() {
  try {
    const logoPath = path.resolve(engineSourceDir, 'assets', 'earningsites-logo.png');
    return readFileSync(logoPath);
  } catch {
    return null;
  }
}

const portalBrandLogoBuffer = readPortalBrandLogoBuffer();
const portalBrandLogoSrc = portalBrandLogoBuffer
  ? `data:image/png;base64,${portalBrandLogoBuffer.toString('base64')}`
  : '';
const siteRegistry = new LocalSiteRegistry(workspaceRoot);
const jobStore = new InMemoryJobStore();
const engine = new DefaultEngineService(siteRegistry, jobStore, createWorkflowRunner);
const factoryOps = new FactoryOpsService(workspaceRoot);
const siteRuntime = new SiteRuntimeService(workspaceRoot);
const portalStore = await createPortalStore({
  postgresUrl: process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL
});
const authService = new AuthService(portalStore);
const billingService = new BillingService(portalStore);

await authService.ensureBootstrapAdmin();

async function bootstrapAdminAccessForKnownSites() {
  const adminEmail = String(process.env.PORTAL_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail) return;
  const admin = await portalStore.getUserWithPasswordHashByEmail(adminEmail);
  if (!admin) return;

  const singleSiteMode = String(process.env.PORTAL_SINGLE_SITE_MODE || 'false').toLowerCase() !== 'false';
  const configuredSiteSlug = sanitizeSiteSlug(
    String(process.env.SITE_SLUG || process.env.NEXT_PUBLIC_SITE_SLUG || '')
  );

  if (singleSiteMode && configuredSiteSlug) {
    await portalStore.assignSiteAccess(admin.user.id, configuredSiteSlug, 'owner');
    return;
  }

  const configuredBootstrapSlugs = parseSiteSlugList(process.env.PORTAL_BOOTSTRAP_SITE_SLUGS || '');
  if (configuredBootstrapSlugs.length === 0) {
    return;
  }

  const knownSites = new Set(
    (await siteRegistry.listSites())
      .map((site) => sanitizeSiteSlug(site.siteSlug))
      .filter(Boolean)
  );

  for (const siteSlug of configuredBootstrapSlugs) {
    if (!knownSites.has(siteSlug)) {
      app.log.warn({ siteSlug }, 'Skipping unknown portal bootstrap site slug');
      continue;
    }
    await portalStore.assignSiteAccess(admin.user.id, siteSlug, 'owner');
  }
}

await bootstrapAdminAccessForKnownSites();

function parseGenerationRequest(body: unknown) {
  return generationJobRequestSchema.parse(body);
}

async function handleStageRoute(stage: 'topics' | 'brief' | 'articles' | 'images' | 'qa' | 'publish', body: unknown) {
  const request = parseGenerationRequest(body);
  const normalizedRequest = { ...request, stage };
  return stage === 'publish' ? engine.runStage(normalizedRequest) : engine.runStage(normalizedRequest);
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  newPassword: z.string().min(8).max(128)
});

const patchPublishingSchema = z.object({
  publishingEnabled: z.boolean().optional(),
  maxPublishesPerRun: z.number().int().min(1).max(50).optional()
});

const monetizationPlacementTargetSchema = z.enum([
  'homeLead',
  'homeMid',
  'categoryTop',
  'articleTop',
  'articleSidebar',
  'articleBottom'
]);

const patchMonetizationSchema = z.object({
  enabled: z.boolean(),
  providerName: z.string().max(120),
  headHtml: z.string().max(50000),
  placements: z.array(
    z.object({
      target: monetizationPlacementTargetSchema,
      html: z.string().max(50000)
    })
  ).max(12)
});

const createCheckoutSessionSchema = z.object({
  plan: z.enum(['base', 'standard', 'pro'])
});

const publishCountSchema = z.object({
  incrementBy: z.number().int().min(1).max(10).optional(),
  articleId: z.string().min(1).max(255).optional()
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const patchContactLegalSchema = z.object({
  publicContactEmail: z
    .string()
    .trim()
    .max(320)
    .refine((value) => value === '' || emailPattern.test(value), 'Enter a valid email address.')
    .optional(),
  privacyPolicyOverride: z.string().max(50000).optional(),
  cookiePolicyOverride: z.string().max(50000).optional(),
  disclaimerOverride: z.string().max(50000).optional()
});

function sanitizeSiteSlug(siteSlug: string) {
  return String(siteSlug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseSiteSlugList(raw: string) {
  return Array.from(
    new Set(
      String(raw || '')
        .split(',')
        .map((value) => sanitizeSiteSlug(value))
        .filter(Boolean)
    )
  );
}

function getPortalBaseUrl() {
  return String(process.env.PORTAL_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
}

app.get('/portal/assets/brand-logo.png', async (_req, reply) => {
  if (!portalBrandLogoBuffer) {
    return reply.code(404).send({ ok: false, error: 'Portal brand logo not available' });
  }

  return reply
    .header('Cache-Control', 'public, max-age=86400, immutable')
    .type('image/png')
    .send(portalBrandLogoBuffer);
});

function getOperationalSiteStatus(entitlement: PortalSiteEntitlement): PortalSiteEntitlement['status'] {
  return isPortalSiteOperational(entitlement) ? 'active' : 'stopped';
}

function resolveSitePublicContactEmail(
  settings: { publicContactEmail?: string },
  registrySite?: { ownerEmail?: string } | null
) {
  return String(settings.publicContactEmail || registrySite?.ownerEmail || '').trim();
}

function resolveMonetizationEnabled(settings: {
  monetization?: Pick<SiteMonetizationSettings, 'enabled' | 'headHtml' | 'placements'> | null;
}) {
  const monetization = settings.monetization;
  if (!monetization?.enabled) return false;
  if (String(monetization.headHtml || '').trim()) return true;
  return Array.isArray(monetization.placements)
    && monetization.placements.some((placement) => String(placement?.html || '').trim());
}

function buildSiteLegalDefaults(siteName: string, settings: {
  monetization?: Pick<SiteMonetizationSettings, 'enabled' | 'headHtml' | 'placements'> | null;
}) {
  const context = {
    siteName,
    adsEnabled: resolveMonetizationEnabled(settings)
  };
  return {
    privacyPolicy: buildDefaultLegalEditableText('privacy', context),
    cookiePolicy: buildDefaultLegalEditableText('cookie', context),
    disclaimer: buildDefaultLegalEditableText('disclaimer', context)
  };
}

async function requireMutablePortalSite(
  req: Parameters<typeof authService.requireSiteAccess>[0],
  reply: Parameters<typeof authService.requireSiteAccess>[1],
  siteSlug: string
) {
  const auth = await authService.requireSiteAccess(req, reply, siteSlug);
  if (!auth) return null;

  const site = await portalStore.getSiteSummaryForUser(auth.user.id, siteSlug);
  if (!site) {
    reply.code(404).send({ ok: false, error: 'Site not found' });
    return null;
  }

  if (isPortalSiteInactiveForOwner(site.entitlement)) {
    reply.code(409).send({
      ok: false,
      error: 'Site inactive',
      code: 'SITE_INACTIVE',
      siteSlug,
      billingMode: site.entitlement.billingMode,
      entitlement: site.entitlement
    });
    return null;
  }

  return { auth, site };
}

type PasswordResetDeliveryMode = 'auto' | 'resend' | 'webhook';
type PasswordResetDeliveryResult = {
  delivered: boolean;
  provider: 'resend' | 'webhook' | 'none';
  reason?: string;
  status?: number;
  id?: string;
};

function getPasswordResetDeliveryMode(): PasswordResetDeliveryMode {
  const raw = String(process.env.PORTAL_PASSWORD_RESET_DELIVERY_MODE || 'auto')
    .trim()
    .toLowerCase();
  if (raw === 'resend' || raw === 'webhook') return raw;
  return 'auto';
}

function escapeHtmlForEmail(value: string) {
  return String(value || '').replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

function isNoReplyMailbox(value: string) {
  const localPart = String(value || '').trim().split('@')[0] || '';
  return /^(?:no-?reply|do-?not-?reply)$/i.test(localPart);
}

function getPortalBrandLogoUrl() {
  return `${getPortalBaseUrl()}/portal/assets/brand-logo.png`;
}

function getPasswordResetEmailLogoSrc() {
  if (!portalBrandLogoSrc) return '';
  const baseUrl = getPortalBaseUrl();
  return /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/i.test(baseUrl)
    ? portalBrandLogoSrc
    : getPortalBrandLogoUrl();
}

function buildPasswordResetEmail(input: { email: string; resetUrl: string; expiresAt: string }) {
  const subject = 'Reset your AI Blogs password';
  const expiresAtDate = new Date(input.expiresAt);
  const expiresAtLabel = Number.isNaN(expiresAtDate.getTime())
    ? input.expiresAt
    : expiresAtDate.toUTCString();
  const replyTo = String(process.env.PORTAL_PASSWORD_RESET_REPLY_TO || '').trim();
  const escapedEmail = escapeHtmlForEmail(input.email);
  const escapedResetUrl = escapeHtmlForEmail(input.resetUrl);
  const escapedExpiresAtLabel = escapeHtmlForEmail(expiresAtLabel);
  const escapedReplyTo = escapeHtmlForEmail(replyTo);
  const hasMonitoredReplyTo = Boolean(replyTo) && !isNoReplyMailbox(replyTo);
  const logoSrc = getPasswordResetEmailLogoSrc();
  const escapedLogoSrc = escapeHtmlForEmail(logoSrc);
  const supportHtml = hasMonitoredReplyTo
    ? `<p style="margin:0 0 14px;color:#6c7a98;font-size:13px;line-height:1.6;">Need help? Contact <a href="mailto:${escapedReplyTo}" style="color:#295bd1;text-decoration:none;">${escapedReplyTo}</a>.</p>`
    : '';
  const supportText = hasMonitoredReplyTo ? `Need help? Contact ${replyTo}.\n\n` : '';
  const automatedNoticeHtml = replyTo && isNoReplyMailbox(replyTo)
    ? '<p style="margin:0 0 14px;color:#6c7a98;font-size:12px;line-height:1.5;">This is an automated email from AI Blogs. Replies to this mailbox are not monitored.</p>'
    : '';
  const automatedNoticeText = replyTo && isNoReplyMailbox(replyTo)
    ? 'This is an automated email from AI Blogs. Replies to this mailbox are not monitored.\n\n'
    : '';
  const brandLogoHtml = logoSrc
    ? `<img src="${escapedLogoSrc}" alt="AI Blogs logo" width="56" height="56" style="display:block;width:56px;height:56px;border:0;outline:none;text-decoration:none;" />`
    : '<div style="width:56px;height:56px;line-height:56px;text-align:center;font-size:24px;font-weight:800;color:#16356a;">AI</div>';
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f3f7ff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#101a34;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f7ff;background-image:radial-gradient(980px 620px at 0% -8%, rgba(75,118,255,.14) 0%, rgba(75,118,255,0) 62%),radial-gradient(900px 560px at 100% -12%, rgba(255,111,184,.14) 0%, rgba(255,111,184,0) 60%),linear-gradient(135deg, #f9fbff 0%, #f1f6ff 52%, #fff5fa 100%);padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(140deg, #2b66ff 0%, #3551dc 48%, #8b3cf2 100%);border-radius:24px 24px 0 0;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-right:14px;vertical-align:middle;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td align="center" valign="middle" style="width:72px;height:72px;padding:8px;border-radius:18px;background:rgba(255,255,255,.94);box-shadow:0 18px 36px -24px rgba(8,18,46,.5);">
                                ${brandLogoHtml}
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="margin:0 0 6px;font-size:11px;line-height:1.2;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.82);font-weight:700;">Password Reset</div>
                          <div style="margin:0;font-size:28px;line-height:1.05;letter-spacing:-0.03em;color:#ffffff;font-weight:800;">AI Blogs</div>
                          <div style="margin:6px 0 0;font-size:13px;line-height:1.5;color:rgba(245,248,255,.9);">Secure access for your site owner portal.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #dfe6f5;border-top:0;border-radius:0 0 24px 24px;box-shadow:0 20px 54px -36px rgba(19,49,111,.4);">
                <tr>
                  <td style="padding:28px;">
                    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;letter-spacing:-0.02em;color:#101a34;">Reset your password</h1>
                    <p style="margin:0 0 12px;color:#334a74;font-size:15px;line-height:1.6;">We received a password reset request for <strong>${escapedEmail}</strong>.</p>
                    <p style="margin:0 0 20px;color:#334a74;font-size:15px;line-height:1.6;">Use the button below to choose a new password. This link expires on <strong>${escapedExpiresAtLabel}</strong>.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                      <tr>
                        <td style="border-radius:12px;background:#2b66ff;">
                          <a href="${escapedResetUrl}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#2b66ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Reset password</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 10px;color:#6c7a98;font-size:12px;line-height:1.5;">If the button does not work, copy and paste this URL into your browser:</p>
                    <p style="margin:0 0 18px;font-size:12px;line-height:1.7;word-break:break-all;">
                      <a href="${escapedResetUrl}" style="color:#295bd1;text-decoration:none;">${escapedResetUrl}</a>
                    </p>
                    ${supportHtml}
                    ${automatedNoticeHtml}
                    <p style="margin:0;color:#6c7a98;font-size:12px;line-height:1.5;">If you did not request this change, you can ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e7ecf8;">
                      <tr>
                        <td style="padding-top:16px;">
                          <div style="font-size:12px;line-height:1.5;color:#6c7a98;">powered by earningsites</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text =
    `Reset your AI Blogs password\n\n` +
    `We received a password reset request for ${input.email}.\n` +
    `Reset link: ${input.resetUrl}\n` +
    `Expires at: ${expiresAtLabel}\n\n` +
    supportText +
    automatedNoticeText +
    `Powered by earningsites.\n\n` +
    `If you did not request this change, you can ignore this email.\n`;
  return {
    subject,
    html,
    text
  };
}

async function sendPasswordResetViaResend(
  input: { email: string; resetUrl: string; expiresAt: string }
): Promise<PasswordResetDeliveryResult> {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.PORTAL_PASSWORD_RESET_FROM || '').trim();
  const replyTo = String(process.env.PORTAL_PASSWORD_RESET_REPLY_TO || '').trim();
  if (!apiKey || !from) {
    return {
      delivered: false,
      provider: 'resend',
      reason: 'resend_not_configured'
    };
  }

  const email = buildPasswordResetEmail(input);
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`password-reset:${input.email.toLowerCase()}:${input.expiresAt}`)
    .digest('hex');

  const body: Record<string, unknown> = {
    from,
    to: [input.email],
    subject: email.subject,
    html: email.html,
    text: email.text
  };
  if (replyTo) {
    body.reply_to = replyTo;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(body)
    });

    const rawBody = await response.text();
    let parsedBody: Record<string, unknown> | null = null;
    try {
      parsedBody = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
    } catch {
      parsedBody = null;
    }

    if (!response.ok) {
      app.log.error(
        {
          email: input.email,
          provider: 'resend',
          status: response.status,
          body: parsedBody ?? rawBody
        },
        'Password reset email send failed'
      );
      return {
        delivered: false,
        provider: 'resend',
        reason: 'resend_failed',
        status: response.status
      };
    }

    return {
      delivered: true,
      provider: 'resend',
      id: typeof parsedBody?.id === 'string' ? parsedBody.id : undefined
    };
  } catch (error) {
    app.log.error(
      {
        email: input.email,
        provider: 'resend',
        error: (error as Error).message
      },
      'Password reset email send errored'
    );
    return {
      delivered: false,
      provider: 'resend',
      reason: 'resend_error'
    };
  }
}

async function sendPasswordResetViaWebhook(
  input: { email: string; resetUrl: string; expiresAt: string }
): Promise<PasswordResetDeliveryResult> {
  const webhookUrl = String(process.env.PORTAL_PASSWORD_RESET_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    return {
      delivered: false,
      provider: 'webhook',
      reason: 'webhook_not_configured'
    };
  }

  const webhookSecret = String(process.env.PORTAL_PASSWORD_RESET_WEBHOOK_SECRET || '').trim();
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookSecret ? { 'x-password-reset-secret': webhookSecret } : {})
      },
      body: JSON.stringify({
        event: 'portal.password_reset.requested',
        email: input.email,
        resetUrl: input.resetUrl,
        expiresAt: input.expiresAt,
        requestedAt: new Date().toISOString()
      })
    });
    if (!response.ok) {
      const body = await response.text();
      app.log.error(
        {
          email: input.email,
          provider: 'webhook',
          status: response.status,
          body
        },
        'Password reset notification webhook failed'
      );
      return {
        delivered: false,
        provider: 'webhook',
        reason: 'webhook_failed',
        status: response.status
      };
    }
    return {
      delivered: true,
      provider: 'webhook'
    };
  } catch (error) {
    app.log.error(
      {
        email: input.email,
        provider: 'webhook',
        error: (error as Error).message
      },
      'Password reset notification webhook errored'
    );
    return {
      delivered: false,
      provider: 'webhook',
      reason: 'webhook_error'
    };
  }
}

async function sendPasswordResetNotification(input: { email: string; resetUrl: string; expiresAt: string }) {
  const mode = getPasswordResetDeliveryMode();
  if (mode === 'resend') {
    const resendResult = await sendPasswordResetViaResend(input);
    if (!resendResult.delivered && resendResult.reason === 'resend_not_configured') {
      app.log.warn(
        {
          email: input.email
        },
        'Password reset delivery mode is resend but RESEND_API_KEY/PORTAL_PASSWORD_RESET_FROM are missing'
      );
    }
    return resendResult;
  }

  if (mode === 'webhook') {
    const webhookResult = await sendPasswordResetViaWebhook(input);
    if (!webhookResult.delivered && webhookResult.reason === 'webhook_not_configured') {
      app.log.warn(
        {
          email: input.email
        },
        'Password reset delivery mode is webhook but PORTAL_PASSWORD_RESET_WEBHOOK_URL is missing'
      );
    }
    return webhookResult;
  }

  const resendResult = await sendPasswordResetViaResend(input);
  if (resendResult.delivered || resendResult.reason !== 'resend_not_configured') {
    return resendResult;
  }

  const webhookResult = await sendPasswordResetViaWebhook(input);
  if (webhookResult.delivered || webhookResult.reason !== 'webhook_not_configured') {
    return webhookResult;
  }

  app.log.warn(
    {
      email: input.email,
      resetUrl: input.resetUrl,
      expiresAt: input.expiresAt
    },
    'Password reset requested but no delivery provider is configured'
  );
  return {
    delivered: false,
    provider: 'none',
    reason: 'no_delivery_provider_configured'
  };
}

function parseStripeWebhookPayload(body: unknown) {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') return JSON.stringify(body);
  return '';
}

function normalizeStripeSubscriptionId(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized.startsWith('sub_') ? normalized : '';
}

async function triggerPlanAutomationNow(siteSlug: string, reason: string) {
  const triggerUrl = String(process.env.PLAN_AUTOMATION_TRIGGER_URL || '').trim();
  if (!triggerUrl) {
    return {
      ok: false,
      skipped: true,
      reason: 'PLAN_AUTOMATION_TRIGGER_URL not configured'
    };
  }

  const internalToken = String(process.env.INTERNAL_API_TOKEN || '').trim();
  try {
    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalToken ? { 'x-internal-token': internalToken } : {})
      },
      body: JSON.stringify({
        siteSlug,
        reason,
        force: true,
        requestedAt: new Date().toISOString()
      })
    });
    const text = await response.text();
    return {
      ok: response.ok,
      skipped: false,
      status: response.status,
      response: text
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: (error as Error).message
    };
  }
}

function getOwnerBootstrapPassword() {
  return String(
    process.env.PORTAL_OWNER_TEMP_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD || 'ChangeMe123!'
  );
}

async function maybeProvisionOwnerAccess(siteSlug: string, ownerEmail: string | undefined) {
  const normalizedEmail = String(ownerEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const user = await authService.createOrUpdateUser(normalizedEmail, getOwnerBootstrapPassword());
  await portalStore.assignSiteAccess(user.id, siteSlug, 'owner');
  return user;
}

async function maybeProvisionAdminAccess(siteSlug: string) {
  const adminEmail = String(process.env.PORTAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.PORTAL_ADMIN_PASSWORD || '');
  if (!adminEmail || !adminPassword) return null;
  const user = await authService.createOrUpdateUser(adminEmail, adminPassword);
  await portalStore.assignSiteAccess(user.id, siteSlug, 'owner');
  return user;
}

function readHeaderValue(request: Parameters<AuthService['requireAuth']>[0], headerName: string) {
  const raw = request.headers[String(headerName || '').toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || '').trim();
  return String(raw || '').trim();
}

function safeSecretEqual(a: string, b: string) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseBasicAuthHeader(request: Parameters<AuthService['requireAuth']>[0]) {
  const authHeader = readHeaderValue(request, 'authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) return null;
  const encoded = authHeader.slice(6).trim();
  if (!encoded) return null;
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep === -1) return null;
    return {
      username: decoded.slice(0, sep),
      password: decoded.slice(sep + 1)
    };
  } catch {
    return null;
  }
}

function requireFactoryUiAccess(
  request: Parameters<AuthService['requireAuth']>[0],
  reply: Parameters<AuthService['requireAuth']>[1]
) {
  const expectedUsername = String(process.env.FACTORY_UI_USERNAME || 'admin').trim();
  const expectedPassword = String(process.env.FACTORY_UI_PASSWORD || process.env.FACTORY_API_SECRET || '').trim();
  if (!expectedPassword) {
    reply.code(503).type('text/plain').send('Factory UI auth not configured');
    return false;
  }

  const credentials = parseBasicAuthHeader(request);
  const valid =
    credentials &&
    safeSecretEqual(credentials.username, expectedUsername) &&
    safeSecretEqual(credentials.password, expectedPassword);

  if (valid) return true;

  reply.header('WWW-Authenticate', 'Basic realm="Factory Ops", charset="UTF-8"');
  reply.code(401).type('text/plain').send('Unauthorized');
  return false;
}

function requireFactoryAccess(
  request: Parameters<AuthService['requireAuth']>[0],
  reply: Parameters<AuthService['requireAuth']>[1],
  options: { allowInternalToken?: boolean } = {}
) {
  const allowInternalToken = options.allowInternalToken !== false;
  const expectedFactorySecret = String(process.env.FACTORY_API_SECRET || '').trim();
  const expectedInternalToken = String(process.env.INTERNAL_API_TOKEN || '').trim();
  const providedFactorySecret = readHeaderValue(request, 'x-factory-secret');
  const providedInternalToken = readHeaderValue(request, 'x-internal-token');

  if (!expectedFactorySecret && !(allowInternalToken && expectedInternalToken)) {
    reply.code(503).send({
      ok: false,
      error: 'Factory auth not configured (set FACTORY_API_SECRET and/or INTERNAL_API_TOKEN)'
    });
    return false;
  }

  if (expectedFactorySecret && providedFactorySecret && safeSecretEqual(providedFactorySecret, expectedFactorySecret)) {
    return true;
  }

  if (allowInternalToken && expectedInternalToken && safeSecretEqual(providedInternalToken, expectedInternalToken)) {
    return true;
  }

  reply.code(401).send({
    ok: false,
    error: 'Unauthorized',
    requiredHeaders: ['x-factory-secret', ...(allowInternalToken ? ['x-internal-token'] : [])]
  });
  return false;
}

app.get('/healthz', async () => ({ ok: true, service: 'autoblog-engine', now: new Date().toISOString() }));

app.get('/portal', async (_req, reply) => {
  const baseUrl = getPortalBaseUrl();
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Site Owner Portal</title>
  ${portalBrandLogoSrc ? `<link rel="icon" type="image/png" href="${portalBrandLogoSrc}" />` : ''}
  <style>
    :root {
      --surface:#ffffff;
      --surface-soft:#f8faff;
      --line:#dfe6f5;
      --text:#101a34;
      --muted:#6c7a98;
      --primary:#2b66ff;
      --primary-dark:#1f4fd4;
      --danger:#a03f3f;
      --danger-bg:#fff1f1;
      --ok:#0f8a61;
    }
    * { box-sizing:border-box; }
    html, body { min-height:100%; }
    body {
      margin:0;
      color:var(--text);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background:
        radial-gradient(980px 620px at 0% -8%, rgba(75, 118, 255, .24) 0%, rgba(75, 118, 255, 0) 62%),
        radial-gradient(900px 560px at 100% -12%, rgba(255, 111, 184, .22) 0%, rgba(255, 111, 184, 0) 60%),
        radial-gradient(840px 520px at 50% 118%, rgba(75, 214, 255, .16) 0%, rgba(75, 214, 255, 0) 58%),
        linear-gradient(135deg, #f9fbff 0%, #f1f6ff 52%, #fff5fa 100%);
      background-attachment: fixed;
    }
    .wrap { max-width:1180px; margin:0 auto; min-height:100vh; padding:28px 16px 24px; }
    .panel {
      border:1px solid var(--line);
      background:linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(250,252,255,.96) 100%);
      border-radius:16px;
      padding:18px;
      box-shadow:0 20px 54px -36px rgba(19, 49, 111, .4);
    }
    .panel + .panel { margin-top:14px; }
    .title { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:8px; }
    .subtitle { color:var(--muted); margin:6px 0 0; font-size:13px; line-height:1.5; }
    .chip { display:inline-flex; align-items:center; border:1px solid #d4def5; border-radius:999px; padding:5px 11px; font-size:12px; color:#29467f; background:#f3f7ff; }
    .grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; }
    .c3{grid-column:span 3}.c4{grid-column:span 4}.c6{grid-column:span 6}.c12{grid-column:span 12}
    .stack { display:grid; gap:12px; }
    .field { display:flex; flex-direction:column; gap:6px; }
    .field label { font-size:12px; font-weight:600; color:#334a74; }
    .toggle-inline {
      display:inline-flex;
      align-items:center;
      gap:10px;
      width:auto;
    }
    .toggle-inline input {
      width:auto;
      padding:0;
      flex:none;
    }
    .hint { color:var(--muted); font-size:12px; line-height:1.4; }
    input,textarea,button { width:100%; border-radius:12px; padding:10px 12px; font-size:14px; }
    input,textarea { border:1px solid #dbe3f3; background:#fff; color:var(--text); }
    textarea { resize:vertical; min-height:180px; font:inherit; line-height:1.55; }
    input:focus,textarea:focus { outline:none; border-color:#8fb2ff; box-shadow:0 0 0 4px rgba(43,102,255,.14); }
    button { cursor:pointer; border:1px solid #d9e2f4; background:#fff; color:var(--text); font-weight:600; }
    button.primary { background:var(--primary); border-color:var(--primary); color:#fff; }
    button.primary:hover { background:var(--primary-dark); border-color:var(--primary-dark); }
    button.warn { background:var(--danger-bg); color:var(--danger); border-color:#f1c7c7; }
    button.ghost { background:#f5f8ff; }
    button.plan-btn { background:#f4f8ff; border-color:#d4e1ff; color:#264c91; }
    button.plan-btn.active { background:#e6efff; border-color:#90adff; color:#17396f; }
    .muted { color:var(--muted); font-size:12px; }
    .actions { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:10px; margin-top:8px; }
    .actions > * { grid-column:span 3; }
    .plans { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin:10px 0 12px; align-items:stretch; }
    .plan {
      position:relative;
      border:1px solid #dbe5fb;
      border-radius:16px;
      padding:14px;
      background:linear-gradient(180deg, #fbfdff 0%, #f5f9ff 100%);
      display:flex;
      flex-direction:column;
      min-height:100%;
    }
    .plan.popular {
      border-color:#8baeff;
      background:linear-gradient(180deg, #f7faff 0%, #eaf1ff 100%);
      box-shadow:0 18px 40px -28px rgba(36, 82, 191, .45);
      transform:translateY(-4px);
    }
    .plan .badge {
      position:absolute;
      top:-11px;
      right:12px;
      border-radius:999px;
      padding:4px 10px;
      background:linear-gradient(90deg, #2f67ff 0%, #5b7fff 100%);
      color:#fff;
      font-size:11px;
      font-weight:700;
      letter-spacing:.03em;
    }
    .plan h5 { margin:0 0 4px; font-size:15px; }
    .plan .desc { margin:0; font-size:12px; color:#50658d; line-height:1.45; }
    .plan .quota { margin-top:8px; font-size:13px; font-weight:700; color:#1f427f; }
    .plan ul {
      margin:10px 0 12px;
      padding:0;
      list-style:none;
      display:grid;
      gap:6px;
      color:#334b75;
      font-size:12px;
      line-height:1.35;
    }
    .plan li { display:flex; align-items:flex-start; gap:7px; }
    .plan li::before { content:"✓"; color:#356af9; font-weight:700; line-height:1; margin-top:1px; }
    .plan .spacer { flex:1; }
    .plan .price {
      font-size:24px;
      font-weight:700;
      letter-spacing:-.01em;
      color:#173968;
      margin:2px 0 2px;
    }
    .plan .price small {
      font-size:11px;
      color:#6780ab;
      font-weight:600;
      letter-spacing:.01em;
      margin-left:4px;
    }
    .plan .meta {
      font-size:11px;
      color:#6c7fa1;
      margin:0 0 10px;
    }
    .plan.popular .price { color:#1548a8; }
    .plan.popular .plan-btn { background:#e0eafe; border-color:#86a5ff; color:#1646a4; }
    .plan .plan-btn[disabled] {
      opacity:.75;
      cursor:not-allowed;
      background:#edf1f8;
      border-color:#d7dfed;
      color:#51627f;
      box-shadow:none;
    }
    .billing-note {
      margin-top:10px;
      border:1px solid #d9e3f7;
      background:#f6f9ff;
      border-radius:10px;
      padding:9px 10px;
      font-size:12px;
      line-height:1.4;
      color:#29487f;
    }
    .billing-note.warn {
      border-color:#ffd9a2;
      background:#fff8ec;
      color:#8a5600;
    }
    .billing-note.ok {
      border-color:#cce7d7;
      background:#f1fcf6;
      color:#106e4f;
    }
    .billing-note h4 {
      margin:0 0 6px;
      font-size:13px;
      color:inherit;
    }
    .billing-note p {
      margin:0 0 7px;
      font-size:12px;
      line-height:1.45;
      color:inherit;
    }
    .billing-note p:last-child { margin-bottom:0; }
    .billing-note ul {
      margin:0 0 7px;
      padding-left:16px;
      font-size:12px;
      line-height:1.45;
      color:inherit;
    }
    .sep { height:1px; background:#e7ecf8; margin:12px 0; }
    a.inline-link { color:#295bd1; text-decoration:none; font-size:12px; font-weight:600; }
    a.inline-link:hover { text-decoration:underline; }

    .auth-shell { min-height:calc(100vh - 56px); display:grid; place-items:center; }
    .auth-panel-stack {
      width:min(980px, 100%);
      display:grid;
      gap:0;
    }
    .auth-card {
      width:100%;
      display:grid;
      grid-template-columns:1.08fr 0.92fr;
      border:1px solid var(--line);
      border-radius:22px;
      overflow:hidden;
      background:var(--surface);
      box-shadow:0 30px 84px -44px rgba(18, 48, 115, .46);
    }
    .auth-brand {
      padding:30px;
      color:#fff;
      background:
        radial-gradient(420px 240px at -8% -10%, rgba(255,255,255,.24) 0%, rgba(255,255,255,0) 65%),
        radial-gradient(340px 200px at 120% 110%, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 62%),
        linear-gradient(140deg, #2b66ff 0%, #3551dc 48%, #8b3cf2 100%);
    }
    .portal-brand {
      display:flex;
      align-items:center;
      gap:12px;
    }
    .portal-brand-logo-wrap {
      display:flex;
      align-items:center;
      justify-content:center;
      border-radius:16px;
      flex:none;
      overflow:hidden;
    }
    .portal-brand-logo-wrap.on-dark {
      background:rgba(255,255,255,.94);
      box-shadow:0 18px 36px -24px rgba(8, 18, 46, .5);
    }
    .portal-brand-logo-wrap.on-light {
      background:#fff;
      border:1px solid #dbe5fb;
      box-shadow:0 14px 32px -24px rgba(18, 48, 115, .35);
    }
    .portal-brand-logo-wrap.lg { width:88px; height:88px; padding:12px; }
    .portal-brand-logo-wrap.sm { width:54px; height:54px; padding:8px; border-radius:14px; }
    .portal-brand-logo {
      display:block;
      width:100%;
      height:100%;
      object-fit:contain;
    }
    .portal-brand-copy {
      min-width:0;
    }
    .portal-brand-name {
      margin:0;
      font-size:22px;
      line-height:1.05;
      letter-spacing:-0.03em;
      font-weight:800;
    }
    .portal-brand-name.light { color:#16356a; font-size:16px; }
    .portal-brand-tagline {
      margin:4px 0 0;
      font-size:12px;
      line-height:1.45;
      color:rgba(245,248,255,.84);
    }
    .portal-brand-tagline.light {
      color:#60759d;
      margin-top:3px;
    }
    .auth-brand-top {
      margin-bottom:22px;
    }
    .auth-brand h1 { margin:6px 0 8px; font-size:30px; line-height:1.1; letter-spacing:-0.02em; }
    .auth-brand p { margin:0; color:rgba(245,248,255,.9); line-height:1.5; }
    .auth-brand .eyebrow { font-size:12px; text-transform:uppercase; letter-spacing:.18em; color:rgba(255,255,255,.82); font-weight:700; }
    .auth-bullets { margin:16px 0 0; padding:0; list-style:none; display:grid; gap:8px; }
    .auth-bullets li { font-size:13px; color:rgba(245,248,255,.92); display:flex; gap:8px; align-items:flex-start; }
    .auth-bullets li::before { content:"•"; font-size:16px; line-height:1; margin-top:-1px; }

    .auth-form { padding:28px 24px; background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
    .auth-form h3 { margin:0; font-size:22px; }
    .auth-form .subtitle { margin:8px 0 14px; }
    .auth-links { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:10px; }
    .link-button {
      width:auto;
      border:0;
      background:transparent;
      padding:0;
      color:#2458d1;
      font-size:12px;
      font-weight:700;
      text-decoration:underline;
      text-underline-offset:2px;
    }
    .link-button:hover { color:#193f9b; }
    .auth-secondary {
      margin-top:14px;
      border-top:1px solid #e2e9fb;
      padding-top:12px;
      display:grid;
      gap:10px;
    }
    .auth-secondary .subtitle {
      margin:0;
      font-size:12px;
      color:#5a6f96;
    }

    .app-shell {
      display:grid;
      grid-template-columns:260px minmax(0, 1fr);
      gap:14px;
      align-items:start;
    }
    .app-sidebar-stack {
      display:grid;
      gap:8px;
      align-content:start;
    }
    .sidebar {
      position:sticky;
      top:14px;
      border:1px solid var(--line);
      border-radius:16px;
      padding:16px;
      background:linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(248,252,255,.95) 100%);
      box-shadow:0 18px 48px -36px rgba(18, 48, 115, .35);
    }
    .sidebar h3 { margin:0; font-size:16px; }
    .sidebar p { margin:6px 0 12px; color:var(--muted); font-size:12px; line-height:1.4; }
    .sidebar-intro {
      padding-bottom:14px;
      margin-bottom:14px;
      border-bottom:1px solid #e5ecfb;
    }
    .sidebar-hello {
      margin:0;
      color:#16356a;
      font-size:14px;
      line-height:1.3;
      font-weight:800;
      letter-spacing:-0.02em;
      overflow-wrap:anywhere;
    }
    .sidebar-question {
      margin:8px 0 0;
      color:#60759d;
      font-size:13px;
      line-height:1.45;
    }
    .side-nav { display:grid; gap:8px; margin-bottom:12px; }
    .side-nav .item {
      display:block;
      width:100%;
      text-align:left;
      text-decoration:none;
      border:1px solid #dde7fb;
      background:#f5f8ff;
      color:#284a85;
      border-radius:10px;
      padding:8px 10px;
      font-size:12px;
      font-weight:600;
    }
    .side-nav button.item { cursor:pointer; }
    .side-nav .item.active {
      border-color:#8ea9ff;
      background:#e9f0ff;
      color:#1b3f82;
    }
    .side-nav .item.disabled {
      opacity:.58;
      pointer-events:none;
    }

    .main-stack { display:grid; gap:14px; min-width:0; }
    .hidden { display:none !important; }
    .modal-overlay {
      position:fixed;
      inset:0;
      z-index:90;
      display:grid;
      place-items:center;
      padding:16px;
      background:rgba(8, 15, 30, 0.45);
      backdrop-filter:blur(2px);
    }
    .modal-card {
      width:min(560px, 100%);
      border:1px solid #dbe5fb;
      border-radius:16px;
      background:#fff;
      padding:16px;
      box-shadow:0 32px 80px -46px rgba(19, 49, 111, .52);
    }
    .modal-card h4 {
      margin:0 0 8px;
      font-size:18px;
      color:#173968;
    }
    .modal-card p {
      margin:0;
      font-size:13px;
      color:#4b628b;
      line-height:1.5;
    }
    .modal-copy p { margin:0 0 8px; }
    .modal-copy p:last-child { margin-bottom:0; }
    .modal-copy ul {
      margin:0 0 8px;
      padding-left:18px;
      color:#4b628b;
      font-size:13px;
      line-height:1.5;
    }
    .modal-copy li { margin:0 0 4px; }
    .modal-copy li:last-child { margin-bottom:0; }
    .modal-actions {
      display:flex;
      gap:10px;
      justify-content:flex-end;
      margin-top:14px;
    }
    .modal-actions button {
      width:auto;
      min-width:120px;
    }
    .notice {
      position:sticky;
      top:8px;
      z-index:30;
      margin:0 0 12px;
      border-radius:12px;
      border:1px solid #dbe6ff;
      background:#f4f8ff;
      color:#1f427f;
      padding:10px 12px;
      font-size:13px;
      font-weight:600;
      box-shadow:0 12px 28px -22px rgba(24, 52, 119, .5);
    }
    .notice.ok { border-color:#bfe8d9; background:#edfdf7; color:#0e6e4e; }
    .notice.warn { border-color:#ffe0ad; background:#fff7e8; color:#8f5a00; }
    .notice.error { border-color:#f3c5c5; background:#fff1f1; color:#9a2f2f; }
    .action-feedback {
      margin:8px 0 0;
      font-size:12px;
      line-height:1.4;
      color:var(--muted);
      min-height:18px;
    }
    .action-feedback.ok { color:#0d7b56; }
    .action-feedback.warn { color:#8f5a00; }
    .action-feedback.error { color:#9a2f2f; }
    .field-feedback {
      margin:2px 0 0;
      border:1px solid #dbe5fb;
      background:#f6f9ff;
      color:#2b4f8f;
      border-radius:10px;
      padding:8px 10px;
      font-size:12px;
      line-height:1.35;
    }
    .field-feedback.ok {
      border-color:#bfe8d9;
      background:#edfdf7;
      color:#0e6e4e;
    }
    .field-feedback.warn {
      border-color:#ffe0ad;
      background:#fff7e8;
      color:#8f5a00;
    }
    .field-feedback.error {
      border-color:#f3c5c5;
      background:#fff1f1;
      color:#9a2f2f;
    }
    button.is-loading {
      opacity:.8;
      cursor:progress;
    }
    button:disabled {
      cursor:not-allowed;
      opacity:.72;
    }
    .portal-support {
      margin:18px auto 0;
      text-align:center;
      font-size:12px;
      color:#66799f;
      line-height:1.5;
    }
    .portal-support a {
      color:#2458d1;
      text-decoration:none;
      font-weight:700;
    }
    .portal-support a:hover {
      text-decoration:underline;
    }
    .powered-by {
      display:flex;
      align-items:center;
      gap:4px;
      margin-top:5px;
      color:#6d7ea0;
      font-size:11px;
      line-height:1.4;
    }
    .powered-by strong {
      font-weight:700;
      color:#4c628d;
    }
    .powered-by .brand-net {
      color:#2e62fff2;
    }
    .powered-by-logo {
      width:20px;
      height:20px;
      object-fit:contain;
      flex:none;
      opacity:.96;
    }
    .auth-powered-by {
      padding-left:16px;
    }
    .app-powered-by {
      margin:0 0 0 8px;
    }

    @media (max-width: 1060px) {
      .auth-card { grid-template-columns:1fr; }
      .auth-brand { min-height:220px; }
      .app-shell { grid-template-columns:1fr; }
      .sidebar { position:static; }
    }
    @media (max-width: 980px) {
      .c3,.c4,.c6,.actions > * { grid-column:span 12; }
      .plans { grid-template-columns:1fr; }
      .auth-shell { min-height:calc(100vh - 32px); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="portalNotice" class="notice hidden" role="status" aria-live="polite"></div>
    <div id="loginShell" class="auth-shell">
      <div class="auth-panel-stack">
        <div id="loginPanel" class="auth-card">
          <div class="auth-brand">
            <p class="eyebrow">Publisher Console</p>
            <h1>Site Owner Portal</h1>
            <p>Configure plan, monetization code, and publishing cadence from one panel.</p>
            <ul class="auth-bullets">
              <li>Subscription plans: Base, Standard, Pro</li>
              <li>Provider-agnostic monetization controls</li>
              <li>Direct access to content management</li>
            </ul>
          </div>
          <div class="auth-form">
            <h3>Sign in</h3>
            <p class="subtitle">Use your owner credentials to access this site workspace.</p>
            <div id="loginFields" class="stack" style="margin-bottom:12px">
              <div class="field">
                <label>Email</label>
                <input id="email" type="email" placeholder="owner@example.com" />
              </div>
              <div class="field">
                <label>Password</label>
                <input id="password" type="password" placeholder="••••••••" />
              </div>
              <p id="loginFeedback" class="field-feedback hidden" role="status" aria-live="polite"></p>
            </div>
            <button id="loginBtn" class="primary">Login</button>
            <div class="auth-links">
              <button id="showForgotBtn" type="button" class="link-button">Forgot password?</button>
              <button id="showLoginBtn" type="button" class="link-button hidden">Back to sign in</button>
            </div>
            <div id="forgotPasswordPanel" class="auth-secondary hidden">
              <p class="subtitle">Enter your account email to receive a password reset link.</p>
              <div class="field">
                <label>Recovery email</label>
                <input id="forgotEmail" type="email" placeholder="owner@example.com" />
              </div>
              <button id="forgotBtn" type="button">Send reset link</button>
              <p id="forgotFeedback" class="field-feedback hidden" role="status" aria-live="polite"></p>
            </div>
            <div id="resetPasswordPanel" class="auth-secondary hidden">
              <p class="subtitle">Set a new password from your reset link.</p>
              <div class="field">
                <label>New password</label>
                <input id="newPassword" type="password" placeholder="At least 8 characters" />
              </div>
              <div class="field">
                <label>Confirm new password</label>
                <input id="confirmNewPassword" type="password" placeholder="Repeat new password" />
              </div>
              <p id="resetFeedback" class="field-feedback hidden" role="status" aria-live="polite"></p>
              <button id="resetBtn" type="button" class="primary">Reset password</button>
            </div>
            <p class="hint" style="margin:10px 0 0">Need help signing in? Use “Forgot password” to request a reset link.</p>
          </div>
        </div>
        <p class="powered-by auth-powered-by">
          <span>Powered by</span>
          ${portalBrandLogoSrc ? `<img src="${portalBrandLogoSrc}" alt="" class="powered-by-logo" />` : ''}
          <strong>EarningSites<span class="brand-net">.net</span></strong>
        </p>
      </div>
    </div>

    <div id="appPanel" class="hidden app-shell">
      <div class="app-sidebar-stack">
        <aside class="sidebar">
          <div class="sidebar-intro">
            <h3 id="me" class="sidebar-hello">👋 Hello</h3>
            <p class="sidebar-question">Manage your content and your subscription</p>
          </div>
          <div class="side-nav">
            <button type="button" class="item active" data-nav-view="monetization">Monetization</button>
            <a id="publishingStudioLink" class="item" target="_blank" rel="noreferrer">Content Management</a>
            <button type="button" class="item" data-nav-view="billing">Billing & Plan</button>
            <button type="button" class="item" data-nav-view="contacts-legal">Contacts & Legal</button>
          </div>
          <button id="logoutBtn" class="warn">Logout</button>
        </aside>
        <p id="appPoweredBy" class="powered-by app-powered-by hidden">
          <span>Powered by</span>
          ${portalBrandLogoSrc ? `<img src="${portalBrandLogoSrc}" alt="" class="powered-by-logo" />` : ''}
          <strong>EarningSites<span class="brand-net">.net</span></strong>
        </p>
      </div>
      <section class="main-stack">
        <div class="panel">
          <div>
            <h2 style="margin:0">Dashboard</h2>
            <p class="subtitle">Manage your active site configuration and subscription plan.</p>
          </div>
        </div>
        <div id="sites"></div>
      </section>
    </div>

    <p class="portal-support">
      <a href="https://www.earningsites.net/terms">Terms of use</a>
      <span aria-hidden="true"> | </span>
      <a href="mailto:info@earningsites.net">Support</a>
    </p>

    <div id="planConfirmModal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="planConfirmTitle">
      <div class="modal-card">
        <h4 id="planConfirmTitle">Confirm plan change</h4>
        <div id="planConfirmText" class="modal-copy">
          <p>Do you want to switch this subscription plan?</p>
        </div>
        <div class="modal-actions">
          <button id="planConfirmCancel" type="button">Cancel</button>
          <button id="planConfirmAccept" type="button" class="primary">Confirm change</button>
        </div>
      </div>
    </div>
  </div>
  <script>
    const out = document.getElementById('out');
    const loginShell = document.getElementById('loginShell');
    const loginPanel = document.getElementById('loginPanel');
    const appPanel = document.getElementById('appPanel');
    const appPoweredBy = document.getElementById('appPoweredBy');
    const meEl = document.getElementById('me');
    const sitesEl = document.getElementById('sites');
    const planConfirmModal = document.getElementById('planConfirmModal');
    const planConfirmTitle = document.getElementById('planConfirmTitle');
    const planConfirmText = document.getElementById('planConfirmText');
    const planConfirmCancel = document.getElementById('planConfirmCancel');
    const planConfirmAccept = document.getElementById('planConfirmAccept');
    const loginFields = document.getElementById('loginFields');
    const loginFeedback = document.getElementById('loginFeedback');
    const showForgotBtn = document.getElementById('showForgotBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const forgotPasswordPanel = document.getElementById('forgotPasswordPanel');
    const resetPasswordPanel = document.getElementById('resetPasswordPanel');
    const forgotFeedback = document.getElementById('forgotFeedback');
    const resetFeedback = document.getElementById('resetFeedback');
    const portalNotice = document.getElementById('portalNotice');
    const publishingStudioLink = document.getElementById('publishingStudioLink');
    const portalSearchParams = new URLSearchParams(window.location.search);
    const selectedSiteSlug = portalSearchParams.get('siteSlug') || '';
    const initialResetToken = portalSearchParams.get('resetToken') || '';
    let activeResetToken = initialResetToken;
    let activeView = 'monetization';
    let authView = initialResetToken ? 'reset' : 'login';
    let noticeTimer = null;
    let pendingPlanChange = null;

    function setOutput(value) {
      if (!out) {
        console.log(value);
        return;
      }
      out.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }
    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#39;'}[c]));
    }
    function readErrorMessage(error) {
      if (!error) return 'Unexpected error';
      if (typeof error === 'string') return error;
      if (typeof error.error === 'string') return error.error;
      const fieldErrors = error?.error?.fieldErrors;
      if (fieldErrors && typeof fieldErrors === 'object') {
        for (const key of Object.keys(fieldErrors)) {
          const messages = fieldErrors[key];
          if (Array.isArray(messages) && messages.length && typeof messages[0] === 'string') {
            return messages[0];
          }
        }
      }
      const formErrors = error?.error?.formErrors;
      if (Array.isArray(formErrors) && formErrors.length && typeof formErrors[0] === 'string') {
        return formErrors[0];
      }
      if (typeof error.message === 'string') return error.message;
      return 'Request failed';
    }
    function isValidEmail(email) {
      return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(email || '').trim());
    }
    function validateLoginInput(email, password) {
      const normalizedEmail = String(email || '').trim();
      const pwd = String(password || '');
      if (!normalizedEmail && !pwd) return 'Email and password are required.';
      if (!normalizedEmail) return 'Email is required.';
      if (!isValidEmail(normalizedEmail)) return 'Enter a valid email address.';
      if (!pwd) return 'Password is required.';
      if (pwd.length < 8) return 'Password must be at least 8 characters.';
      return '';
    }
    function validateForgotPasswordInput(email) {
      const normalizedEmail = String(email || '').trim();
      if (!normalizedEmail) return 'Email is required.';
      if (!isValidEmail(normalizedEmail)) return 'Enter a valid email address.';
      return '';
    }
    function validateResetPasswordInput(password, confirmPassword) {
      const pwd = String(password || '');
      const confirm = String(confirmPassword || '');
      if (!pwd) return 'New password is required.';
      if (pwd.length < 8) return 'New password must be at least 8 characters.';
      if (pwd !== confirm) return 'Password confirmation does not match.';
      return '';
    }
    function showNotice(message, kind = 'ok', timeoutMs = 4200) {
      if (!(portalNotice instanceof HTMLElement)) return;
      if (noticeTimer) clearTimeout(noticeTimer);
      portalNotice.textContent = String(message || '');
      portalNotice.className = 'notice ' + (kind || 'ok');
      portalNotice.classList.remove('hidden');
      noticeTimer = setTimeout(() => {
        portalNotice.classList.add('hidden');
      }, timeoutMs);
    }
    function setInlineFeedback(el, message, kind = '') {
      if (!(el instanceof HTMLElement)) return;
      el.textContent = String(message || '');
      el.className = 'action-feedback' + (kind ? ' ' + kind : '');
    }
    function setLoginFeedback(message, kind = '') {
      if (!(loginFeedback instanceof HTMLElement)) return;
      const text = String(message || '').trim();
      if (!text) {
        loginFeedback.textContent = '';
        loginFeedback.className = 'field-feedback hidden';
        return;
      }
      loginFeedback.textContent = text;
      loginFeedback.className = 'field-feedback' + (kind ? ' ' + kind : '');
      loginFeedback.classList.remove('hidden');
    }
    function setForgotFeedback(message, kind = '') {
      if (!(forgotFeedback instanceof HTMLElement)) return;
      const text = String(message || '').trim();
      if (!text) {
        forgotFeedback.textContent = '';
        forgotFeedback.className = 'field-feedback hidden';
        return;
      }
      forgotFeedback.textContent = text;
      forgotFeedback.className = 'field-feedback' + (kind ? ' ' + kind : '');
      forgotFeedback.classList.remove('hidden');
    }
    function setResetFeedback(message, kind = '') {
      if (!(resetFeedback instanceof HTMLElement)) return;
      const text = String(message || '').trim();
      if (!text) {
        resetFeedback.textContent = '';
        resetFeedback.className = 'field-feedback hidden';
        return;
      }
      resetFeedback.textContent = text;
      resetFeedback.className = 'field-feedback' + (kind ? ' ' + kind : '');
      resetFeedback.classList.remove('hidden');
    }
    function setAuthView(mode) {
      const normalizedMode = mode === 'forgot' || mode === 'reset' ? mode : 'login';
      authView = normalizedMode;
      const loginBtn = document.getElementById('loginBtn');
      if (loginFields instanceof HTMLElement) {
        loginFields.classList.toggle('hidden', normalizedMode !== 'login');
      }
      if (loginBtn instanceof HTMLElement) {
        loginBtn.classList.toggle('hidden', normalizedMode !== 'login');
      }
      if (showForgotBtn instanceof HTMLElement) {
        showForgotBtn.classList.toggle('hidden', normalizedMode !== 'login');
      }
      if (showLoginBtn instanceof HTMLElement) {
        showLoginBtn.classList.toggle('hidden', normalizedMode === 'login');
      }
      if (forgotPasswordPanel instanceof HTMLElement) {
        forgotPasswordPanel.classList.toggle('hidden', normalizedMode !== 'forgot');
      }
      if (resetPasswordPanel instanceof HTMLElement) {
        resetPasswordPanel.classList.toggle('hidden', normalizedMode !== 'reset');
      }
      if (normalizedMode === 'reset' && !activeResetToken) {
        setResetFeedback('Open the reset link from your email to continue.', 'warn');
      }
    }
    function removeResetTokenFromUrl() {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('resetToken');
      window.history.replaceState({}, '', nextUrl.toString());
    }
    function setButtonBusy(button, busy, busyLabel) {
      if (!(button instanceof HTMLButtonElement)) return;
      if (busy) {
        if (!button.dataset.originalLabel) {
          button.dataset.originalLabel = button.textContent || '';
        }
        button.disabled = true;
        button.classList.add('is-loading');
        button.textContent = busyLabel || button.dataset.originalLabel || 'Working...';
        return;
      }
      button.disabled = false;
      button.classList.remove('is-loading');
      if (button.dataset.originalLabel) {
        button.textContent = button.dataset.originalLabel;
      }
    }
    function closePlanModal() {
      if (planConfirmModal instanceof HTMLElement) {
        planConfirmModal.classList.add('hidden');
      }
      pendingPlanChange = null;
      if (planConfirmAccept instanceof HTMLButtonElement) {
        planConfirmAccept.disabled = false;
        planConfirmAccept.textContent = 'Confirm change';
      }
    }
    function getPlanMeta(plan) {
      if (plan === 'pro') return { label: 'Pro', price: '49,90 USD/month' };
      if (plan === 'standard') return { label: 'Standard', price: '19,90 USD/month' };
      return { label: 'Base', price: '4,99 USD/month' };
    }
    function getPlanRank(plan) {
      if (plan === 'pro') return 3;
      if (plan === 'standard') return 2;
      return 1;
    }
    function getPlanQuota(plan) {
      if (plan === 'pro') return 60;
      if (plan === 'standard') return 20;
      return 3;
    }
    async function executePlanChange(slug, plan) {
      const buttons = Array.from(document.querySelectorAll('[data-action=\"start-plan\"][data-slug]'));
      const triggerButton = buttons.find((btn) => {
        if (!(btn instanceof HTMLElement)) return false;
        return btn.getAttribute('data-slug') === slug && btn.getAttribute('data-plan') === plan;
      });
      setButtonBusy(triggerButton, true, 'Processing...');
      try {
        const res = await api('/api/portal/sites/' + encodeURIComponent(slug) + '/billing/checkout-session', {
          method: 'POST',
          body: JSON.stringify({ plan })
        });
        setOutput(res);
        if (res.url) {
          window.location.href = res.url;
          return;
        }
        if (res.mode === 'updated') {
          showNotice('Subscription updated successfully.', 'ok');
          await loadSites();
        } else if (res.mode === 'downgrade_scheduled') {
          const effectiveAtLabel = res.pendingEffectiveAt
            ? new Date(res.pendingEffectiveAt).toLocaleDateString()
            : 'next billing cycle';
          const nextPlan = String(res.pendingPlan || plan || '').trim();
          const nextPlanLabel = nextPlan ? (nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1)) : 'new plan';
          showNotice(
            'Downgrade scheduled: access remains unchanged until ' + effectiveAtLabel + ', then switches to ' + nextPlanLabel + '.',
            'ok',
            7000
          );
          await loadSites();
        } else if (res.mode === 'unchanged') {
          showNotice('Selected plan is already active.', 'warn');
        }
      } catch (error) {
        setOutput(error);
        showNotice(readErrorMessage(error), 'error', 5600);
      } finally {
        setButtonBusy(triggerButton, false);
      }
    }
    function openPlanModal(slug, currentPlan, plan) {
      const meta = getPlanMeta(plan);
      const currentMeta = getPlanMeta(currentPlan);
      const currentRank = getPlanRank(currentPlan);
      const nextRank = getPlanRank(plan);
      const currentQuota = getPlanQuota(currentPlan);
      const nextQuota = getPlanQuota(plan);
      pendingPlanChange = { slug, plan };
      if (planConfirmTitle instanceof HTMLElement) {
        if (nextRank > currentRank) {
          planConfirmTitle.textContent = 'Ready to scale your publishing?';
        } else if (nextRank < currentRank) {
          planConfirmTitle.textContent = 'Downgrade to ' + meta.label + '?';
        } else {
          planConfirmTitle.textContent = 'Confirm plan change';
        }
      }
      if (planConfirmText instanceof HTMLElement) {
        if (nextRank > currentRank) {
          planConfirmText.innerHTML =
            '<p>Upgrading to <strong>' +
            escapeHtml(meta.label) +
            '</strong> increases your monthly capacity from <strong>' +
            escapeHtml(currentQuota) +
            '</strong> to <strong>' +
            escapeHtml(nextQuota) +
            '</strong> articles and gives you access to priority generation and optimization reviews.</p>' +
            '<p>Perfect for growing sites that want consistent content output.</p>';
        } else if (nextRank < currentRank) {
          planConfirmText.innerHTML =
            '<p>You will lose access to:</p>' +
            '<ul>' +
            '<li>Up to <strong>' + escapeHtml(currentQuota) + '</strong> articles per month</li>' +
            '<li>Priority generation queue</li>' +
            '<li>Monthly optimization review</li>' +
            '</ul>' +
            '<p>Your plan will be limited to <strong>' + escapeHtml(nextQuota) + '</strong> articles per month from the next billing cycle.</p>' +
            '<p>No credit is issued for the remaining current cycle.</p>' +
            '<p>If you are expecting traffic growth soon, keeping your current plan may help maintain your publishing cadence.</p>';
        } else {
          planConfirmText.innerHTML =
            '<p>Switch to <strong>' + escapeHtml(meta.label) + '</strong> (' + escapeHtml(meta.price) + ')? Stripe may apply prorated charges/credits based on your current billing period.</p>';
        }
      }
      if (planConfirmModal instanceof HTMLElement) {
        planConfirmModal.classList.remove('hidden');
      }
    }

    function applyActiveView() {
      const panels = document.querySelectorAll('[data-view-panel]');
      for (const panel of panels) {
        if (!(panel instanceof HTMLElement)) continue;
        panel.classList.toggle('hidden', panel.dataset.viewPanel !== activeView);
      }
      const navItems = document.querySelectorAll('[data-nav-view]');
      for (const item of navItems) {
        if (!(item instanceof HTMLElement)) continue;
        item.classList.toggle('active', item.dataset.navView === activeView);
      }
    }

    function getInputValue(id) {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return el.value;
      }
      return '';
    }

    function getCheckboxValue(id) {
      const el = document.getElementById(id);
      return el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : false;
    }

    async function api(path, options = {}) {
      const res = await fetch(path, {
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
        ...options
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) {
        const err = json || { error: text || 'Request failed' };
        throw err;
      }
      return json ?? {};
    }

    async function loadSession() {
      try {
        const me = await api('/api/portal/me');
        loginPanel.classList.add('hidden');
        loginShell.classList.add('hidden');
        appPanel.classList.remove('hidden');
        if (appPoweredBy instanceof HTMLElement) appPoweredBy.classList.remove('hidden');
        meEl.textContent = '👋 Hello ' + (me.user?.email || 'there');
        await loadSites();
      } catch {
        loginPanel.classList.remove('hidden');
        loginShell.classList.remove('hidden');
        appPanel.classList.add('hidden');
        if (appPoweredBy instanceof HTMLElement) appPoweredBy.classList.add('hidden');
        setAuthView(authView);
      }
    }

    async function loadSites() {
      const query = selectedSiteSlug ? ('?siteSlug=' + encodeURIComponent(selectedSiteSlug)) : '';
      const data = await api('/api/portal/sites' + query);
      const sites = Array.isArray(data.sites) ? data.sites : [];
      sitesEl.innerHTML = '';
      if (!sites.length) {
        if (publishingStudioLink instanceof HTMLAnchorElement) {
          publishingStudioLink.removeAttribute('href');
          publishingStudioLink.classList.add('disabled');
        }
        const empty = document.createElement('div');
        empty.className = 'panel';
        empty.innerHTML = '<p class="muted">No site associated with this account yet.</p>';
        sitesEl.appendChild(empty);
        return;
      }

      const firstSite = sites[0];
      const resolvedStudioUrl = String(
        firstSite?.studioUrlResolved ||
        firstSite?.settings?.studioUrl ||
        (window.location.hostname === 'localhost' ? 'http://localhost:3333' : '')
      ).trim();
      if (publishingStudioLink instanceof HTMLAnchorElement) {
        if (resolvedStudioUrl && !firstSite?.inactiveForOwner) {
          publishingStudioLink.href = resolvedStudioUrl;
          publishingStudioLink.classList.remove('disabled');
        } else {
          publishingStudioLink.removeAttribute('href');
          publishingStudioLink.classList.add('disabled');
        }
      }

      for (const site of sites) {
        const slug = site.siteSlug;
        const idSafe = slug.replace(/[^a-z0-9]/gi, '-');
        const currentPlan = String(site.entitlement?.plan || 'base');
        const currentPlanLabel = currentPlan
          ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)
          : 'Base';
        const inactiveForOwner = Boolean(site.inactiveForOwner);
        const pendingPlan = String(site.entitlement?.pendingPlan || '').trim();
        const pendingPlanLabel = pendingPlan
          ? pendingPlan.charAt(0).toUpperCase() + pendingPlan.slice(1)
          : '';
        const pendingEffectiveAt = String(site.entitlement?.pendingEffectiveAt || '').trim();
        const pendingEffectiveAtLabel = pendingEffectiveAt
          ? new Date(pendingEffectiveAt).toLocaleDateString()
          : '';
        const pendingDowngradeHtml = pendingPlan
          ? '<div class="billing-note warn">Downgrade scheduled to <strong>' +
            escapeHtml(pendingPlanLabel) +
            '</strong> on <strong>' +
            escapeHtml(pendingEffectiveAtLabel || 'next cycle') +
            '</strong>. Current quota remains active until then.</div>'
          : '';
        const inactiveReason =
          site.entitlement?.billingStatus === 'overdue'
            ? 'Payment is overdue. Open Billing & Plan to reactivate the subscription and resume publishing and site management.'
            : 'No active subscription is attached to this site. Choose a plan in Billing & Plan to reactivate it.';
        const inactiveBannerHtml = inactiveForOwner
          ? \`
            <div class="billing-note warn" style="margin-bottom:16px;">
              <strong>Site inactive.</strong> \${escapeHtml(inactiveReason)}
              <div class="actions" style="margin-top:12px;">
                <button class="ghost" data-action="show-billing-tab">Open Billing &amp; Plan</button>
              </div>
            </div>
          \`
          : '';
        const monetizationLockHintHtml = inactiveForOwner
          ? '<div class="hint" style="margin-bottom:12px;">Monetization settings are visible, but updates stay locked until the site is reactivated.</div>'
          : '';
        const contactLegalLockHintHtml = inactiveForOwner
          ? '<div class="hint" style="margin-bottom:12px;">Contact and legal settings are visible, but updates stay locked until the site is reactivated.</div>'
          : '';
        const disableMutationsAttr = inactiveForOwner ? 'disabled aria-disabled="true" title="Site inactive"' : '';
        const isCurrentPlanDisabled = (plan) => currentPlan === plan && !inactiveForOwner;
        const planButtonLabel = (plan) => {
          if (currentPlan === plan && !inactiveForOwner) return 'Current plan';
          return 'Choose';
        };
        const publicContactEmail =
          site.settings?.publicContactEmail ||
          site.publicContactEmailResolved ||
          data.user?.email ||
          '';
        const monetization = site.settings?.monetization || {
          enabled: false,
          providerName: '',
          headHtml: '',
          placements: []
        };
        const placementHtmlByTarget = {};
        for (const placement of Array.isArray(monetization.placements) ? monetization.placements : []) {
          const targetKey = String(placement?.target || '').trim();
          if (!targetKey) continue;
          placementHtmlByTarget[targetKey] = String(placement?.html || '');
        }
        const monetizationPlacementFields = [
          { target: 'homeLead', label: 'Home lead', hint: 'Rendered after the homepage lead modules.' },
          { target: 'homeMid', label: 'Home mid', hint: 'Rendered later in the homepage feed.' },
          { target: 'categoryTop', label: 'Category top', hint: 'Rendered below the category hero.' },
          { target: 'articleTop', label: 'Article top', hint: 'Rendered above the article content layout.' },
          { target: 'articleSidebar', label: 'Article sidebar', hint: 'Rendered in the article sidebar rail.' },
          { target: 'articleBottom', label: 'Article bottom', hint: 'Rendered below the article content.' }
        ];
        const advancedPlacementsOpen = monetizationPlacementFields.some((field) => placementHtmlByTarget[field.target]) ? 'open' : '';
        const privacyPolicyValue = site.settings?.privacyPolicyOverride || site.legalDefaults?.privacyPolicy || '';
        const cookiePolicyValue = site.settings?.cookiePolicyOverride || site.legalDefaults?.cookiePolicy || '';
        const disclaimerValue = site.settings?.disclaimerOverride || site.legalDefaults?.disclaimer || '';
        const wrapper = document.createElement('div');
        wrapper.className = 'panel';
        wrapper.innerHTML = \`
          <div class="title">
            <div>
              <h3>\${escapeHtml(site.brandName || slug)}</h3>
              <p class="subtitle">Site slug: <code>\${escapeHtml(slug)}</code></p>
            </div>
            <span class="chip">\${inactiveForOwner ? 'Site inactive' : 'Billing: ' + escapeHtml(site.entitlement?.billingStatus || 'trial')}</span>
          </div>

          \${inactiveBannerHtml}

          <div data-view-panel="monetization">
            <div class="grid">
              <div class="c6 field">
                <label class="toggle-inline">
                  <input id="monetizationEnabled-\${idSafe}" type="checkbox" \${monetization.enabled ? 'checked' : ''} />
                  <span>Enable monetization</span>
                </label>
                <div class="hint">Disable this if you want to keep snippets saved without injecting them on the public site.</div>
              </div>
              <div class="c6 field">
                <label>Provider / network name</label>
                <input id="monetizationProvider-\${idSafe}" placeholder="AdSense, Nitro, Journey, Raptive..." value="\${escapeHtml(monetization.providerName || '')}" />
                <div class="hint">Optional name to help you recognize the provider.</div>
              </div>
              <div class="c12 field">
                <label>Head code</label>
                <textarea id="monetizationHead-\${idSafe}" rows="10" placeholder="&lt;script async src=&quot;...&quot;&gt;&lt;/script&gt;">\${escapeHtml(monetization.headHtml || '')}</textarea>
                <div class="hint">Use this for provider scripts that must load in the document head.</div>
              </div>
            </div>

            <details class="billing-note" \${advancedPlacementsOpen}>
              <summary><strong>Advanced placements</strong> <span class="hint">Add body embeds only where the provider requires a page placeholder.</span></summary>
              <div class="grid" style="margin-top:12px;">
                \${monetizationPlacementFields.map((field) => \`
                  <div class="c12 field">
                    <label>\${escapeHtml(field.label)}</label>
                    <textarea id="placement-\${field.target}-\${idSafe}" rows="6" placeholder="&lt;div&gt;Provider embed&lt;/div&gt;&lt;script&gt;...&lt;/script&gt;">\${escapeHtml(placementHtmlByTarget[field.target] || '')}</textarea>
                    <div class="hint">\${escapeHtml(field.hint)}</div>
                  </div>
                \`).join('')}
              </div>
            </details>

            <div class="billing-note warn" style="margin-top:14px;">
              <h4>Before enabling monetization</h4>
              <ul>
                <li>Confirm the provider approves the site and traffic profile you expect.</li>
                <li>Handle any required <code>ads.txt</code>, CMP / consent, or privacy setup outside this panel.</li>
                <li>Some premium networks require exclusivity or minimum traffic before activation.</li>
                <li>Custom snippets execute third-party code on the public site, so broken HTML or scripts can affect layout and performance.</li>
              </ul>
            </div>

            \${monetizationLockHintHtml}
            <div class="actions">
              <button class="primary" data-action="save-monetization" data-slug="\${escapeHtml(slug)}" \${disableMutationsAttr}>Save Monetization</button>
              <a href="${baseUrl}/api/factory/site/\${encodeURIComponent(slug)}/status" target="_blank" class="inline-link">Site status JSON</a>
              <p id="saveAdsFeedback-\${idSafe}" class="action-feedback c12" role="status" aria-live="polite"></p>
            </div>
          </div>

          <div data-view-panel="contacts-legal" class="hidden">
            <div class="grid">
              <div class="c6 field">
                <label>Public contact email</label>
                <input id="publicContactEmail-\${idSafe}" type="email" placeholder="owner@example.com" value="\${escapeHtml(publicContactEmail)}" />
                <div class="hint">Shown on the public contact page. If left empty in site settings, the public site can still fall back to the current owner contact known by the portal.</div>
              </div>
              <div class="c12 field">
                <label>Privacy Policy</label>
                <textarea id="privacyPolicy-\${idSafe}" rows="12" placeholder="## Information we may collect">\${escapeHtml(privacyPolicyValue)}</textarea>
                <div class="hint">Edit the public policy text for this site. Clear and save to restore the platform default.</div>
              </div>
              <div class="c12 field">
                <label>Cookie Policy</label>
                <textarea id="cookiePolicy-\${idSafe}" rows="12" placeholder="## What cookies are">\${escapeHtml(cookiePolicyValue)}</textarea>
                <div class="hint">Use plain text with optional <code>## Section titles</code> and <code>- bullets</code>.</div>
              </div>
              <div class="c12 field">
                <label>Disclaimer</label>
                <textarea id="disclaimer-\${idSafe}" rows="12" placeholder="## Informational editorial content">\${escapeHtml(disclaimerValue)}</textarea>
                <div class="hint">The public site uses this text as-is. Clear and save to fall back to the shared default disclaimer.</div>
              </div>
            </div>

            \${contactLegalLockHintHtml}
            <div class="actions">
              <button class="primary" data-action="save-contact-legal" data-slug="\${escapeHtml(slug)}" \${disableMutationsAttr}>Save Contacts & Legal</button>
              <p id="saveContactLegalFeedback-\${idSafe}" class="action-feedback c12" role="status" aria-live="polite"></p>
            </div>
          </div>

          <div data-view-panel="billing" class="hidden">
            <div class="plans">
              <div class="plan">
                <h5>Base</h5>
                <p class="desc">For low-volume maintenance.</p>
                <div class="quota">3 articles / month</div>
                <ul>
                  <li>Basic publishing cadence</li>
                  <li>Flexible monetization controls</li>
                  <li>Email support (standard SLA)</li>
                </ul>
                <div class="spacer"></div>
                <div class="price">4,99 USD<small>/month</small></div>
                <p class="meta">Starter plan for small traffic sites.</p>
                <button class="plan-btn \${currentPlan === 'base' ? 'active' : ''}" data-action="start-plan" data-plan="base" data-current-plan="\${escapeHtml(currentPlan)}" data-slug="\${escapeHtml(slug)}" \${isCurrentPlanDisabled('base') ? 'disabled aria-disabled="true" title="Current plan"' : ''}>\${planButtonLabel('base')}</button>
              </div>
              <div class="plan popular">
                <span class="badge">Most Popular</span>
                <h5>Standard</h5>
                <p class="desc">Balanced growth cadence.</p>
                <div class="quota">20 articles / month</div>
                <ul>
                  <li>Higher monthly content quota</li>
                  <li>Priority generation queue</li>
                  <li>Monthly optimization review</li>
                </ul>
                <div class="spacer"></div>
                <div class="price">19,90 USD<small>/month</small></div>
                <p class="meta">Recommended for growing editorial sites.</p>
                <button class="plan-btn \${currentPlan === 'standard' ? 'active' : ''}" data-action="start-plan" data-plan="standard" data-current-plan="\${escapeHtml(currentPlan)}" data-slug="\${escapeHtml(slug)}" \${isCurrentPlanDisabled('standard') ? 'disabled aria-disabled="true" title="Current plan"' : ''}>\${planButtonLabel('standard')}</button>
              </div>
              <div class="plan">
                <h5>Pro</h5>
                <p class="desc">High-frequency publishing.</p>
                <div class="quota">60 articles / month</div>
                <ul>
                  <li>Maximum publishing capacity</li>
                  <li>Advanced workflow tuning</li>
                  <li>Faster support turnaround</li>
                </ul>
                <div class="spacer"></div>
                <div class="price">49,90 USD<small>/month</small></div>
                <p class="meta">For aggressive growth and scale.</p>
                <button class="plan-btn \${currentPlan === 'pro' ? 'active' : ''}" data-action="start-plan" data-plan="pro" data-current-plan="\${escapeHtml(currentPlan)}" data-slug="\${escapeHtml(slug)}" \${isCurrentPlanDisabled('pro') ? 'disabled aria-disabled="true" title="Current plan"' : ''}>\${planButtonLabel('pro')}</button>
              </div>
            </div>
            <div class="hint">Current plan: <strong>\${escapeHtml(currentPlanLabel)}</strong> • Monthly quota: <strong>\${escapeHtml(site.entitlement?.monthlyQuota || 0)}</strong> • Published this month: <strong>\${escapeHtml(site.entitlement?.publishedThisMonth || 0)}</strong></div>
            \${pendingDowngradeHtml}

            <div class="actions">
              <button class="ghost" data-action="open-billing" data-slug="\${escapeHtml(slug)}">Open Billing Portal</button>
            </div>
          </div>
        \`;
        sitesEl.appendChild(wrapper);
      }

      applyActiveView();
    }

    setAuthView(authView);

    if (showForgotBtn instanceof HTMLButtonElement) {
      showForgotBtn.addEventListener('click', () => {
        const forgotEmailInput = document.getElementById('forgotEmail');
        if (forgotEmailInput instanceof HTMLInputElement && !forgotEmailInput.value.trim()) {
          forgotEmailInput.value = getInputValue('email').trim();
        }
        setForgotFeedback('');
        setResetFeedback('');
        setAuthView('forgot');
      });
    }
    if (showLoginBtn instanceof HTMLButtonElement) {
      showLoginBtn.addEventListener('click', () => {
        if (authView === 'reset') {
          activeResetToken = '';
          removeResetTokenFromUrl();
        }
        setForgotFeedback('');
        setResetFeedback('');
        setAuthView('login');
      });
    }

    const forgotBtn = document.getElementById('forgotBtn');
    if (forgotBtn instanceof HTMLButtonElement) {
      forgotBtn.addEventListener('click', async () => {
        setButtonBusy(forgotBtn, true, 'Sending link...');
        setForgotFeedback('Preparing reset instructions...');
        try {
          const email = (getInputValue('forgotEmail') || getInputValue('email')).trim();
          const validationError = validateForgotPasswordInput(email);
          if (validationError) {
            setForgotFeedback(validationError, 'error');
            return;
          }
          const res = await api('/api/portal/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
          });
          setOutput(res);
          setForgotFeedback(res.message || 'If an account exists, reset instructions were sent.', 'ok');
        } catch (error) {
          setOutput(error);
          setForgotFeedback(readErrorMessage(error), 'error');
        } finally {
          setButtonBusy(forgotBtn, false);
        }
      });
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn instanceof HTMLButtonElement) {
      resetBtn.addEventListener('click', async () => {
        setButtonBusy(resetBtn, true, 'Resetting...');
        setResetFeedback('Updating password...');
        try {
          const token = String(activeResetToken || '').trim();
          if (!token) {
            setResetFeedback('Open the reset link from your email to continue.', 'error');
            return;
          }
          const newPassword = getInputValue('newPassword');
          const confirmNewPassword = getInputValue('confirmNewPassword');
          const validationError = validateResetPasswordInput(newPassword, confirmNewPassword);
          if (validationError) {
            setResetFeedback(validationError, 'error');
            return;
          }
          const res = await api('/api/portal/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({
              token,
              newPassword
            })
          });
          setOutput(res);
          setResetFeedback('Password reset completed.', 'ok');
          activeResetToken = '';
          removeResetTokenFromUrl();
          const newPasswordInput = document.getElementById('newPassword');
          const confirmPasswordInput = document.getElementById('confirmNewPassword');
          if (newPasswordInput instanceof HTMLInputElement) newPasswordInput.value = '';
          if (confirmPasswordInput instanceof HTMLInputElement) confirmPasswordInput.value = '';
          setAuthView('login');
          setLoginFeedback('Password updated. Please sign in with your new password.', 'ok');
        } catch (error) {
          setOutput(error);
          setResetFeedback(readErrorMessage(error), 'error');
        } finally {
          setButtonBusy(resetBtn, false);
        }
      });
    }

    document.getElementById('loginBtn').addEventListener('click', async () => {
      const loginBtn = document.getElementById('loginBtn');
      setButtonBusy(loginBtn, true, 'Logging in...');
      setLoginFeedback('Signing in...');
      try {
        const email = getInputValue('email').trim();
        const password = getInputValue('password');
        const validationError = validateLoginInput(email, password);
        if (validationError) {
          setLoginFeedback(validationError, 'error');
          return;
        }
        const payload = {
          email,
          password
        };
        const res = await api('/api/portal/auth/login', { method: 'POST', body: JSON.stringify(payload) });
        setOutput(res);
        setLoginFeedback('Login successful.', 'ok');
        await loadSession();
      } catch (error) {
        setOutput(error);
        const message = readErrorMessage(error);
        setLoginFeedback(message, 'error');
      } finally {
        setButtonBusy(loginBtn, false);
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        await api('/api/portal/auth/logout', { method: 'POST', body: '{}' });
        await loadSession();
      } catch (error) {
        setOutput(error);
      }
    });

    if (planConfirmCancel instanceof HTMLElement) {
      planConfirmCancel.addEventListener('click', () => {
        closePlanModal();
      });
    }
    if (planConfirmModal instanceof HTMLElement) {
      planConfirmModal.addEventListener('click', (event) => {
        if (event.target === planConfirmModal) {
          closePlanModal();
        }
      });
    }
    if (planConfirmAccept instanceof HTMLButtonElement) {
      planConfirmAccept.addEventListener('click', async () => {
        if (!pendingPlanChange) return;
        planConfirmAccept.disabled = true;
        planConfirmAccept.textContent = 'Applying...';
        const { slug, plan } = pendingPlanChange;
        closePlanModal();
        await executePlanChange(slug, plan);
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && planConfirmModal instanceof HTMLElement && !planConfirmModal.classList.contains('hidden')) {
        closePlanModal();
      }
    });

    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const navView = target.getAttribute('data-nav-view');
      if (navView) {
        activeView = navView;
        applyActiveView();
        return;
      }

      const action = target.getAttribute('data-action');
      const slug = target.getAttribute('data-slug');
      if (!action || !slug) return;
      const idSafe = slug.replace(/[^a-z0-9]/gi, '-');

      try {
        if (action === 'save-monetization') {
          setButtonBusy(target, true, 'Saving...');
          const saveFeedback = document.getElementById('saveAdsFeedback-' + idSafe);
          setInlineFeedback(saveFeedback, 'Saving monetization settings...', '');
          const placementTargets = ['homeLead', 'homeMid', 'categoryTop', 'articleTop', 'articleSidebar', 'articleBottom'];
          const placements = placementTargets
            .map((placementTarget) => ({
              target: placementTarget,
              html: getInputValue('placement-' + placementTarget + '-' + idSafe).trim()
            }))
            .filter((placement) => placement.html);
          const payload = {
            enabled: getCheckboxValue('monetizationEnabled-' + idSafe),
            providerName: getInputValue('monetizationProvider-' + idSafe).trim(),
            headHtml: getInputValue('monetizationHead-' + idSafe),
            placements
          };
          const res = await api('/api/portal/sites/' + encodeURIComponent(slug) + '/monetization', { method: 'PATCH', body: JSON.stringify(payload) });
          setOutput(res);
          let feedbackType = 'ok';
          let feedbackMessage = 'Monetization saved successfully.';
          if (res?.sanitySync?.ok === false && res?.sanitySync?.skipped) {
            feedbackType = 'warn';
            feedbackMessage = 'Saved locally, but Sanity sync was skipped.';
          } else if (res?.sanitySync?.ok === false) {
            feedbackType = 'warn';
            feedbackMessage = 'Saved locally, but Sanity sync failed.';
          }
          setInlineFeedback(saveFeedback, feedbackMessage, feedbackType);
          showNotice(feedbackMessage, feedbackType);
          setButtonBusy(target, false);
          await loadSites();
          return;
        }

        if (action === 'save-contact-legal') {
          setButtonBusy(target, true, 'Saving...');
          const saveFeedback = document.getElementById('saveContactLegalFeedback-' + idSafe);
          setInlineFeedback(saveFeedback, 'Saving public contact and legal settings...', '');
          const publicContactEmail = getInputValue('publicContactEmail-' + idSafe).trim();
          if (publicContactEmail && !isValidEmail(publicContactEmail)) {
            setInlineFeedback(saveFeedback, 'Enter a valid email address.', 'error');
            setButtonBusy(target, false);
            return;
          }
          const payload = {
            publicContactEmail,
            privacyPolicyOverride: getInputValue('privacyPolicy-' + idSafe),
            cookiePolicyOverride: getInputValue('cookiePolicy-' + idSafe),
            disclaimerOverride: getInputValue('disclaimer-' + idSafe)
          };
          const res = await api('/api/portal/sites/' + encodeURIComponent(slug) + '/contact-legal', {
            method: 'PATCH',
            body: JSON.stringify(payload)
          });
          setOutput(res);
          let feedbackType = 'ok';
          let feedbackMessage = 'Contacts & legal settings saved successfully.';
          if (res?.sanitySync?.ok === false && res?.sanitySync?.skipped) {
            feedbackType = 'warn';
            feedbackMessage = 'Saved locally, but Sanity sync was skipped.';
          } else if (res?.sanitySync?.ok === false) {
            feedbackType = 'warn';
            feedbackMessage = 'Saved locally, but Sanity sync failed.';
          }
          setInlineFeedback(saveFeedback, feedbackMessage, feedbackType);
          showNotice(feedbackMessage, feedbackType);
          setButtonBusy(target, false);
          await loadSites();
          return;
        }

        if (action === 'show-billing-tab') {
          activeView = 'billing';
          applyActiveView();
          return;
        }

        if (action === 'open-billing') {
          const res = await api('/api/portal/sites/' + encodeURIComponent(slug) + '/billing/portal-session', { method: 'POST', body: '{}' });
          setOutput(res);
          if (res.url) {
            const popup = window.open(res.url, '_blank');
            if (!popup) {
              showNotice('Popup blocked by browser. Allow popups for this site to open Billing Portal in a new tab.', 'warn', 6500);
            }
          }
          return;
        }

        if (action === 'start-plan') {
          const plan = target.getAttribute('data-plan');
          const currentPlan = target.getAttribute('data-current-plan') || 'base';
          openPlanModal(slug, currentPlan, plan);
          return;
        }
      } catch (error) {
        setOutput(error);
        if (action === 'save-ads') {
          const saveFeedback = document.getElementById('saveAdsFeedback-' + idSafe);
          const message = readErrorMessage(error);
          setInlineFeedback(saveFeedback, message, 'error');
          showNotice(message, 'error', 5600);
          setButtonBusy(target, false);
        } else if (action === 'save-contact-legal') {
          const saveFeedback = document.getElementById('saveContactLegalFeedback-' + idSafe);
          const message = readErrorMessage(error);
          setInlineFeedback(saveFeedback, message, 'error');
          showNotice(message, 'error', 5600);
          setButtonBusy(target, false);
        }
      }
    });

    loadSession();
  </script>
</body>
</html>`;
  return reply.type('text/html').send(html);
});

app.post('/api/portal/auth/login', async (req, reply) => {
  const parsed = loginSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const auth = await authService.login(parsed.data.email, parsed.data.password);
  if (!auth) {
    return reply.code(401).send({ ok: false, error: 'Invalid credentials' });
  }

  authService.setSessionCookie(reply, auth.session.token, auth.session.expiresAt);
  return {
    ok: true,
    user: auth.user,
    expiresAt: auth.session.expiresAt
  };
});

app.post('/api/portal/auth/forgot-password', async (req, reply) => {
  const parsed = forgotPasswordSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const genericMessage = 'If an account exists for this email, reset instructions have been sent.';
  const resetRequest = await authService.requestPasswordReset(parsed.data.email);
  if (!resetRequest) {
    return {
      ok: true,
      message: genericMessage
    };
  }

  const resetUrl = `${getPortalBaseUrl()}/portal?resetToken=${encodeURIComponent(resetRequest.token)}`;
  await sendPasswordResetNotification({
    email: resetRequest.user.email,
    resetUrl,
    expiresAt: resetRequest.expiresAt
  });

  return {
    ok: true,
    message: genericMessage
  };
});

app.post('/api/portal/auth/reset-password', async (req, reply) => {
  const parsed = resetPasswordSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const auth = await authService.resetPasswordWithToken(parsed.data.token, parsed.data.newPassword);
  if (!auth) {
    return reply.code(400).send({ ok: false, error: 'Invalid or expired reset token' });
  }

  authService.clearSessionCookie(reply);
  return {
    ok: true,
    message: 'Password updated. Please sign in with your new password.'
  };
});

app.post('/api/portal/auth/logout', async (req, reply) => {
  const token = authService.getSessionTokenFromRequest(req);
  await authService.logoutByToken(token);
  authService.clearSessionCookie(reply);
  return { ok: true };
});

app.get('/api/portal/me', async (req, reply) => {
  const auth = await authService.requireAuth(req, reply);
  if (!auth) return;
  return {
    ok: true,
    user: auth.user
  };
});

app.get('/api/portal/sites', async (req, reply) => {
  const auth = await authService.requireAuth(req, reply);
  if (!auth) return;

  const query = (req.query || {}) as { siteSlug?: string };
  const requestedSiteSlug = sanitizeSiteSlug(String(query.siteSlug || ''));
  if (requestedSiteSlug && !(await portalStore.hasSiteAccess(auth.user.id, requestedSiteSlug))) {
    return reply.code(403).send({ ok: false, error: 'Forbidden' });
  }

  const singleSiteMode = String(process.env.PORTAL_SINGLE_SITE_MODE || 'false').toLowerCase() !== 'false';
  const configuredSiteSlug = sanitizeSiteSlug(
    String(process.env.SITE_SLUG || process.env.NEXT_PUBLIC_SITE_SLUG || '')
  );
  const effectiveSiteSlug = requestedSiteSlug || (singleSiteMode ? configuredSiteSlug : '');
  const sitesRaw = await portalStore.listSitesForUser(auth.user.id);
  const scopedRaw = effectiveSiteSlug
    ? sitesRaw.filter((site) => site.siteSlug === effectiveSiteSlug)
    : sitesRaw;
  const limitedRaw = singleSiteMode ? scopedRaw.slice(0, 1) : scopedRaw;

  const sites = await Promise.all(
    limitedRaw.map(async (site) => {
      const blueprint = await siteRegistry.getSite(site.siteSlug);
      const registrySite = await siteRuntime.getRegistrySite(site.siteSlug);
      const siteEnv = await siteRuntime.readSiteEnv(site.siteSlug);
      const brandName = blueprint?.brandName || site.siteSlug;
      const studioUrlResolved = String(
        site.settings.studioUrl ||
        registrySite?.studioUrl ||
        siteEnv.SANITY_STUDIO_URL ||
        process.env.SANITY_STUDIO_URL ||
        ''
      ).trim();
      return {
        ...site,
        brandName,
        studioUrlResolved,
        publicContactEmailResolved: resolveSitePublicContactEmail(site.settings, registrySite),
        legalDefaults: buildSiteLegalDefaults(brandName, site.settings),
        inactiveForOwner: isPortalSiteInactiveForOwner(site.entitlement),
        operationalStatus: getOperationalSiteStatus(site.entitlement)
      };
    })
  );
  return {
    ok: true,
    user: auth.user,
    count: sites.length,
    sites
  };
});

app.get('/api/portal/sites/:siteSlug', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  const auth = await authService.requireSiteAccess(req, reply, siteSlug);
  if (!auth) return;

  const site = await portalStore.getSiteSummaryForUser(auth.user.id, siteSlug);
  if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });
  const blueprint = await siteRegistry.getSite(siteSlug);
  const registrySite = await siteRuntime.getRegistrySite(siteSlug);
  const brandName = blueprint?.brandName || site.siteSlug;
  return {
    ok: true,
    site: {
      ...site,
      brandName,
      publicContactEmailResolved: resolveSitePublicContactEmail(site.settings, registrySite),
      legalDefaults: buildSiteLegalDefaults(brandName, site.settings),
      inactiveForOwner: isPortalSiteInactiveForOwner(site.entitlement),
      operationalStatus: getOperationalSiteStatus(site.entitlement)
    }
  };
});

app.get('/api/public/sites/:siteSlug/state', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  if (!siteSlug) {
    return reply.code(400).send({ ok: false, error: 'Invalid site slug' });
  }

  const blueprint = await siteRegistry.getSite(siteSlug);
  if (!blueprint) {
    return reply.code(404).send({ ok: false, error: 'Site not found' });
  }

  const entitlement = await portalStore.getEntitlementEffective(siteSlug);
  const operationalStatus = getOperationalSiteStatus(entitlement);
  const inactiveForOwner = isPortalSiteInactiveForOwner(entitlement);

  return {
    ok: true,
    site: {
      siteSlug,
      brandName: blueprint.brandName || siteSlug,
      inactiveForOwner,
      operationalStatus,
      publicStatus: operationalStatus === 'active' ? 'online' : 'offline',
      entitlement: {
        plan: entitlement.plan,
        status: operationalStatus,
        billingMode: entitlement.billingMode,
        billingStatus: entitlement.billingStatus
      }
    }
  };
});

app.get('/api/public/sites/:siteSlug/settings', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  if (!siteSlug) {
    return reply.code(400).send({ ok: false, error: 'Invalid site slug' });
  }

  const blueprint = await siteRegistry.getSite(siteSlug);
  if (!blueprint) {
    return reply.code(404).send({ ok: false, error: 'Site not found' });
  }

  const settings = await portalStore.getSiteSettings(siteSlug);
  const registrySite = await siteRuntime.getRegistrySite(siteSlug);

  return {
    ok: true,
    site: {
      siteSlug,
      publicContactEmail: resolveSitePublicContactEmail(settings, registrySite),
      privacyPolicyOverride: String(settings.privacyPolicyOverride || ''),
      cookiePolicyOverride: String(settings.cookiePolicyOverride || ''),
      disclaimerOverride: String(settings.disclaimerOverride || '')
    }
  };
});

app.patch('/api/portal/sites/:siteSlug/publishing', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  if (!(await requireMutablePortalSite(req, reply, siteSlug))) return;

  const parsed = patchPublishingSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const settings = await portalStore.patchSiteSettings(siteSlug, parsed.data);
  const entitlement = await portalStore.getEntitlementEffective(siteSlug);
  const sync = await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);
  return {
    ok: true,
    siteSlug,
    settings,
    entitlement,
    sanitySync: sync
  };
});

app.patch('/api/portal/sites/:siteSlug/monetization', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  if (!(await requireMutablePortalSite(req, reply, siteSlug))) return;

  const parsed = patchMonetizationSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const settings = await portalStore.patchSiteSettings(siteSlug, { monetization: parsed.data });
  const entitlement = await portalStore.getEntitlementEffective(siteSlug);
  await siteRuntime.upsertRegistrySite(siteSlug, {
    monetization: {
      enabled: settings.monetization.enabled,
      providerName: settings.monetization.providerName,
      hasHeadHtml: Boolean(String(settings.monetization.headHtml || '').trim()),
      placementTargets: settings.monetization.placements.map((placement) => placement.target)
    },
    studioUrl: settings.studioUrl
  });
  const sync = await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);
  return {
    ok: true,
    siteSlug,
    settings,
    entitlement,
    sanitySync: sync
  };
});

app.patch('/api/portal/sites/:siteSlug/contact-legal', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  if (!(await requireMutablePortalSite(req, reply, siteSlug))) return;

  const parsed = patchContactLegalSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const settings = await portalStore.patchSiteSettings(siteSlug, parsed.data);
  const entitlement = await portalStore.getEntitlementEffective(siteSlug);
  const sync = await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);
  return {
    ok: true,
    siteSlug,
    settings,
    entitlement,
    sanitySync: sync
  };
});

app.post('/api/portal/sites/:siteSlug/billing/portal-session', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  const auth = await authService.requireSiteAccess(req, reply, siteSlug);
  if (!auth) return;

  let entitlement = await portalStore.getEntitlementEffective(siteSlug);
  if (!entitlement.stripeCustomerId) {
    try {
      const created = await billingService.createCustomer({
        email: auth.user.email,
        siteSlug
      });
      entitlement = await portalStore.patchEntitlement(siteSlug, {
        stripeCustomerId: created.customerId
      });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: (error as Error).message });
    }
  }

  if (!entitlement.stripeCustomerId) {
    return reply.code(400).send({ ok: false, error: 'Stripe customer not available for this site' });
  }

  const returnUrl = `${getPortalBaseUrl()}/portal?siteSlug=${encodeURIComponent(siteSlug)}`;
  try {
    const session = await billingService.createCustomerPortalSession({
      siteSlug,
      customerId: entitlement.stripeCustomerId,
      returnUrl
    });
    return {
      ok: true,
      url: session.url
    };
  } catch (error) {
    return reply.code(500).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/api/portal/sites/:siteSlug/billing/checkout-session', async (req, reply) => {
  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  const auth = await authService.requireSiteAccess(req, reply, siteSlug);
  if (!auth) return;

  const parsed = createCheckoutSessionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  let entitlement = await portalStore.getEntitlementEffective(siteSlug);
  if (!entitlement.stripeCustomerId) {
    try {
      const created = await billingService.createCustomer({
        email: auth.user.email,
        siteSlug
      });
      entitlement = await portalStore.patchEntitlement(siteSlug, {
        stripeCustomerId: created.customerId
      });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: (error as Error).message });
    }
  }

  if (!entitlement.stripeCustomerId) {
    return reply.code(400).send({ ok: false, error: 'Stripe customer not available for this site' });
  }

  const sanitizedSubscriptionId = normalizeStripeSubscriptionId(entitlement.stripeSubscriptionId);
  if (entitlement.stripeSubscriptionId && sanitizedSubscriptionId !== entitlement.stripeSubscriptionId) {
    entitlement = await portalStore.patchEntitlement(siteSlug, {
      stripeSubscriptionId: sanitizedSubscriptionId
    });
  }

  if (!sanitizedSubscriptionId && entitlement.stripeCustomerId) {
    try {
      const recovered = await billingService.findUpdatableSubscriptionForCustomer(entitlement.stripeCustomerId);
      if (recovered?.subscriptionId) {
        const window = getCurrentMonthWindow();
        entitlement = await portalStore.patchEntitlement(siteSlug, {
          plan: recovered.plan,
          monthlyQuota: getQuotaForPlan(recovered.plan),
          periodStart: window.periodStartIso,
          periodEnd: window.periodEndIso,
          pendingPlan: '',
          pendingMonthlyQuota: 0,
          pendingEffectiveAt: '',
          pendingStripePriceId: '',
          status: 'active',
          stripeCustomerId: recovered.customerId || entitlement.stripeCustomerId,
          stripeSubscriptionId: recovered.subscriptionId,
          stripePriceId: recovered.priceId || '',
          billingMode: 'customer_paid',
          billingStatus: recovered.billingStatus
        });
      }
    } catch {
      // Fallback to checkout if lookup fails.
    }
  }

  if (
    entitlement.pendingPlan &&
    entitlement.pendingPlan === parsed.data.plan &&
    normalizeStripeSubscriptionId(entitlement.stripeSubscriptionId)
  ) {
    return {
      ok: true,
      mode: 'downgrade_scheduled',
      plan: entitlement.plan,
      pendingPlan: entitlement.pendingPlan,
      pendingEffectiveAt: entitlement.pendingEffectiveAt,
      billingStatus: entitlement.billingStatus,
      message: 'Downgrade already scheduled for next billing cycle'
    };
  }

  if (
    entitlement.plan === parsed.data.plan &&
    !entitlement.pendingPlan &&
    normalizeStripeSubscriptionId(entitlement.stripeSubscriptionId)
  ) {
    return {
      ok: true,
      mode: 'unchanged',
      plan: entitlement.plan,
      billingStatus: entitlement.billingStatus,
      message: 'Selected plan is already active'
    };
  }

  if (
    normalizeStripeSubscriptionId(entitlement.stripeSubscriptionId) &&
    entitlement.status !== 'stopped' &&
    entitlement.billingStatus !== 'canceled'
  ) {
    const direction = comparePlanRank(entitlement.plan, parsed.data.plan);
    const changeMode = direction > 0 ? 'upgrade' : direction < 0 ? 'downgrade' : 'lateral';

    try {
      const updated = await billingService.updateExistingSubscriptionPlan({
        siteSlug,
        subscriptionId: normalizeStripeSubscriptionId(entitlement.stripeSubscriptionId),
        plan: parsed.data.plan,
        changeMode
      });

      if (updated.noChange) {
        return {
          ok: true,
          mode: 'unchanged',
          plan: entitlement.plan,
          billingStatus: entitlement.billingStatus,
          message: 'Selected plan is already active'
        };
      }

      const settings = await portalStore.getSiteSettings(siteSlug);
      if (changeMode === 'downgrade') {
        entitlement = await portalStore.patchEntitlement(siteSlug, {
          // Keep current plan active until end of billing cycle.
          plan: entitlement.plan,
          monthlyQuota: entitlement.monthlyQuota,
          periodStart: entitlement.periodStart,
          periodEnd: entitlement.periodEnd,
          pendingPlan: parsed.data.plan,
          pendingMonthlyQuota: getQuotaForPlan(parsed.data.plan),
          pendingEffectiveAt: updated.currentPeriodEnd || entitlement.periodEnd,
          pendingStripePriceId: updated.priceId || '',
          status: 'active',
          stripeCustomerId: updated.customerId || entitlement.stripeCustomerId,
          stripeSubscriptionId: updated.subscriptionId || entitlement.stripeSubscriptionId,
          stripePriceId: entitlement.stripePriceId,
          billingMode: 'customer_paid',
          billingStatus: updated.billingStatus
        });

        const sync = await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);
        return {
          ok: true,
          mode: 'downgrade_scheduled',
          plan: entitlement.plan,
          pendingPlan: entitlement.pendingPlan,
          pendingEffectiveAt: entitlement.pendingEffectiveAt,
          billingStatus: entitlement.billingStatus,
          sanitySync: sync,
          automationTrigger: { ok: true, skipped: true, reason: 'Downgrade scheduled for next cycle' }
        };
      }

      const window = getCurrentMonthWindow();
      entitlement = await portalStore.patchEntitlement(siteSlug, {
        plan: updated.plan,
        monthlyQuota: getQuotaForPlan(updated.plan),
        periodStart: window.periodStartIso,
        periodEnd: window.periodEndIso,
        pendingPlan: '',
        pendingMonthlyQuota: 0,
        pendingEffectiveAt: '',
        pendingStripePriceId: '',
        status: 'active',
        stripeCustomerId: updated.customerId || entitlement.stripeCustomerId,
        stripeSubscriptionId: updated.subscriptionId || entitlement.stripeSubscriptionId,
        stripePriceId: updated.priceId || entitlement.stripePriceId,
        billingMode: 'customer_paid',
        billingStatus: updated.billingStatus
      });

      const sync = await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);
      const automationTrigger = await triggerPlanAutomationNow(siteSlug, 'plan_change_updated');

      return {
        ok: true,
        mode: 'updated',
        plan: updated.plan,
        billingStatus: updated.billingStatus,
        sanitySync: sync,
        automationTrigger
      };
    } catch (error) {
      const message = String((error as Error).message || '');
      const isNotUpdatable =
        message.includes('STRIPE_SUBSCRIPTION_NOT_UPDATABLE') ||
        message.includes('invalid-canceled-subscription-fields');
      if (!isNotUpdatable) {
        return reply.code(500).send({ ok: false, error: message });
      }

      entitlement = await portalStore.patchEntitlement(siteSlug, {
        stripeSubscriptionId: '',
        stripePriceId: '',
        pendingPlan: '',
        pendingMonthlyQuota: 0,
        pendingEffectiveAt: '',
        pendingStripePriceId: '',
        status: 'stopped',
        billingMode: 'customer_paid',
        billingStatus: 'n/a'
      });
    }
  }

  const safeSlug = encodeURIComponent(siteSlug);
  const successUrl = `${getPortalBaseUrl()}/portal?siteSlug=${safeSlug}&billing=success`;
  const cancelUrl = `${getPortalBaseUrl()}/portal?siteSlug=${safeSlug}&billing=cancel`;

  try {
    const session = await billingService.createCheckoutSession({
      siteSlug,
      customerId: entitlement.stripeCustomerId,
      plan: parsed.data.plan,
      successUrl,
      cancelUrl
    });
    return {
      ok: true,
      mode: 'checkout',
      plan: parsed.data.plan,
      url: session.url,
      sessionId: session.sessionId
    };
  } catch (error) {
    return reply.code(500).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/api/billing/webhooks/stripe', async (req, reply) => {
  const signature = String(req.headers['stripe-signature'] || '');
  const rawBody = (req as typeof req & RawBodyRequest).rawBody ?? parseStripeWebhookPayload(req.body);

  try {
    const result = await billingService.processWebhook(rawBody, signature);
    let automationTrigger: Record<string, unknown> | null = null;

    if (result && typeof result === 'object' && 'siteSlug' in result && typeof result.siteSlug === 'string' && result.siteSlug) {
      const siteSlug = result.siteSlug;
      const settings = await portalStore.getSiteSettings(siteSlug);
      const entitlement = await portalStore.getEntitlementEffective(siteSlug);
      await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);

      const eventType = 'type' in result ? String(result.type || '') : '';
      const planApplied = !('planApplied' in result) || Boolean(result.planApplied);
      const shouldTrigger =
        planApplied && (eventType === 'checkout.session.completed' || eventType === 'customer.subscription.updated');
      if (shouldTrigger) {
        automationTrigger = await triggerPlanAutomationNow(siteSlug, `stripe_${eventType}`);
      }
    }

    return { ok: true, result, automationTrigger };
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.get('/api/internal/sites/automation-targets', async (req, reply) => {
  const internalToken = String(process.env.INTERNAL_API_TOKEN || '').trim();
  if (!internalToken) {
    return reply.code(503).send({ ok: false, error: 'INTERNAL_API_TOKEN not configured' });
  }
  const provided = String(req.headers['x-internal-token'] || '').trim();
  if (provided !== internalToken) {
    return reply.code(401).send({ ok: false, error: 'Unauthorized' });
  }

  const query = (req.query || {}) as { includeInactive?: string };
  const includeInactive = String(query.includeInactive || '').toLowerCase() === 'true';
  const registry = await siteRuntime.loadRegistry();
  const seen = new Set<string>();
  const targets: string[] = [];
  const skipped: Array<{ siteSlug: string; reason: string }> = [];

  for (const entry of registry.sites || []) {
    const siteSlug = sanitizeSiteSlug(String(entry.siteSlug || ''));
    if (!siteSlug || seen.has(siteSlug)) continue;
    seen.add(siteSlug);

    const automationStatus = String(entry.automationStatus || 'inactive').toLowerCase();
    if (!includeInactive && automationStatus !== 'active') {
      skipped.push({ siteSlug, reason: `automationStatus=${automationStatus || 'inactive'}` });
      continue;
    }

    const sanity = await siteRuntime.getSiteSanityConnection(siteSlug);
    if (!sanity.projectId || !sanity.readToken || !sanity.writeToken) {
      skipped.push({ siteSlug, reason: 'missing_per_site_sanity_credentials' });
      continue;
    }

    targets.push(siteSlug);
  }

  return {
    ok: true,
    count: targets.length,
    targets,
    skipped
  };
});

app.get('/api/internal/sites/:siteSlug/sanity-connection', async (req, reply) => {
  const internalToken = String(process.env.INTERNAL_API_TOKEN || '').trim();
  if (!internalToken) {
    return reply.code(503).send({ ok: false, error: 'INTERNAL_API_TOKEN not configured' });
  }
  const provided = String(req.headers['x-internal-token'] || '').trim();
  if (provided !== internalToken) {
    return reply.code(401).send({ ok: false, error: 'Unauthorized' });
  }

  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  const sanity = await siteRuntime.getSiteSanityConnection(siteSlug);

  if (!sanity.projectId || !sanity.readToken || !sanity.writeToken) {
    return reply.code(400).send({
      ok: false,
      siteSlug,
      error:
        'Missing per-site Sanity credentials. Expected SANITY_PROJECT_ID, SANITY_READ_TOKEN, SANITY_WRITE_TOKEN in the site runtime env (.env.generated)'
    });
  }

  return {
    ok: true,
    siteSlug,
    sanity
  };
});

app.get('/api/internal/sites/:siteSlug/entitlement', async (req, reply) => {
  const internalToken = String(process.env.INTERNAL_API_TOKEN || '').trim();
  if (!internalToken) {
    return reply.code(503).send({ ok: false, error: 'INTERNAL_API_TOKEN not configured' });
  }
  const provided = String(req.headers['x-internal-token'] || '').trim();
  if (provided !== internalToken) {
    return reply.code(401).send({ ok: false, error: 'Unauthorized' });
  }

  const params = req.params as { siteSlug: string };
  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  const entitlement = await portalStore.getEntitlementEffective(siteSlug);
  const settings = await portalStore.getSiteSettings(siteSlug);
  const operationalStatus = getOperationalSiteStatus(entitlement);
  const now = new Date().toISOString();
  const periodWindow = getCurrentMonthWindow();

  return {
    ok: true,
    siteSlug,
    at: now,
    quota: {
      monthlyQuota: entitlement.monthlyQuota,
      publishedThisMonth: entitlement.publishedThisMonth,
      remaining: Math.max(0, entitlement.monthlyQuota - entitlement.publishedThisMonth),
      periodStart: entitlement.periodStart || periodWindow.periodStartIso,
      periodEnd: entitlement.periodEnd || periodWindow.periodEndIso
    },
    plan: entitlement.plan,
    billingMode: entitlement.billingMode,
    pendingPlan: entitlement.pendingPlan,
    pendingEffectiveAt: entitlement.pendingEffectiveAt,
    status: operationalStatus,
    publishingEnabled: settings.publishingEnabled
  };
});

app.post('/api/internal/sites/:siteSlug/publish-count', async (req, reply) => {
  const internalToken = String(process.env.INTERNAL_API_TOKEN || '').trim();
  if (!internalToken) {
    return reply.code(503).send({ ok: false, error: 'INTERNAL_API_TOKEN not configured' });
  }
  const provided = String(req.headers['x-internal-token'] || '').trim();
  if (provided !== internalToken) {
    return reply.code(401).send({ ok: false, error: 'Unauthorized' });
  }

  const params = req.params as { siteSlug: string };
  const parsed = publishCountSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const siteSlug = sanitizeSiteSlug(params.siteSlug);
  const incrementBy = Math.max(1, Number(parsed.data.incrementBy || 1));
  const articleId = String(parsed.data.articleId || '').trim();

  const countResult = articleId
    ? await portalStore.incrementPublishedCountIdempotent(siteSlug, articleId, incrementBy)
    : {
        counted: true,
        reason: 'counted_without_article_id',
        entitlement: await portalStore.incrementPublishedCount(siteSlug, incrementBy)
      };
  const entitlement = countResult.entitlement;
  const settings = await portalStore.getSiteSettings(siteSlug);
  const sync = await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);

  return {
    ok: true,
    siteSlug,
    counted: countResult.counted,
    reason: countResult.reason,
    articleId: articleId || null,
    incrementBy,
    entitlement,
    sanitySync: sync
  };
});

app.post('/v1/generation/topics', async (req, reply) => {
  try {
    return await handleStageRoute('topics', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/brief', async (req, reply) => {
  try {
    return await handleStageRoute('brief', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/articles', async (req, reply) => {
  try {
    return await handleStageRoute('articles', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/images', async (req, reply) => {
  try {
    return await handleStageRoute('images', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/qa', async (req, reply) => {
  try {
    return await handleStageRoute('qa', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/publish', async (req, reply) => {
  try {
    return await handleStageRoute('publish', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/pipelines/run', async (req, reply) => {
  try {
    const request = parseGenerationRequest(req.body);
    return await engine.runPipeline({ ...request, stage: 'pipeline' });
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.get('/v1/jobs/:jobId', async (req, reply) => {
  const params = req.params as { jobId: string };
  const job = await engine.getJob(params.jobId);
  if (!job) {
    return reply.code(404).send({ ok: false, error: 'Job not found' });
  }
  return job;
});

app.get('/v1/sites/:siteSlug/health', async (req) => {
  const params = req.params as { siteSlug: string };
  return engine.health(params.siteSlug);
});

app.get('/v1/content/categories', async (req, reply) => {
  const query = req.query as { siteSlug?: string };
  const siteSlug = query.siteSlug;
  if (!siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug query param is required' });
  }

  const site = await siteRegistry.getSite(siteSlug);
  if (!site) {
    return reply.code(404).send({ ok: false, error: `Unknown site: ${siteSlug}` });
  }

  return {
    siteSlug,
    source: 'blueprint',
    items: site.categories.map((category, index) => ({
      _id: `cat-${category.slug || index}`,
      title: category.title,
      slug: category.slug,
      description: category.description,
      accent: category.accent
    }))
  };
});

app.get('/v1/content/articles', async (req, reply) => {
  const query = req.query as { siteSlug?: string };
  const siteSlug = query.siteSlug;
  if (!siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug query param is required' });
  }

  const site = await siteRegistry.getSite(siteSlug);
  if (!site) {
    return reply.code(404).send({ ok: false, error: `Unknown site: ${siteSlug}` });
  }

  // Placeholder read-side endpoint. Real implementation should query the publishing target through a repository/adapter.
  return {
    siteSlug,
    source: 'publisher-read-adapter-pending',
    items: []
  };
});

app.get('/v1/factory/sites', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const sites = await siteRegistry.listSites();
  return {
    count: sites.length,
    sites: sites.map((site) => ({
      siteSlug: site.siteSlug,
      brandName: site.brandName,
      publishingTarget: site.publishingTarget.kind,
      deploymentTarget: site.deploymentTarget.kind
    }))
  };
});

app.get('/api/factory/site/:siteSlug/status', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const params = req.params as { siteSlug: string };
  return factoryOps.siteStatus(params.siteSlug);
});

app.get('/api/factory/options', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  return {
    nichePresets: factoryOps.listNichePresets(),
    businessModes: ['transfer_first', 'managed'],
    themeTones: ['auto', 'editorial', 'luxury', 'wellness', 'playful', 'technical'],
    themeRecipes: [
      'bold_magazine',
      'editorial_luxury',
      'warm_wellness',
      'playful_kids',
      'technical_minimal',
      'noir_luxury_dark',
      'midnight_wellness_dark',
      'arcade_play_dark'
    ],
    topicSources: ['suggest', 'synthetic'],
    topicStatuses: ['queued', 'brief_ready', 'generated', 'skipped']
  };
});

app.post('/api/factory/site/create', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const body = (req.body || {}) as {
    siteSlug?: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    nichePrompt?: string;
    primaryNiche?: string;
    categoryLabels?: string[];
    seedTopicLabels?: string[];
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    applyCmsMutations?: boolean;
    sanityProjectId?: string;
    sanityDataset?: string;
    sanityApiVersion?: string;
    sanityReadToken?: string;
    sanityWriteToken?: string;
    studioUrl?: string;
    ownerEmail?: string;
    force?: boolean;
  };
  if (!body.siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  }
  const result = await factoryOps.createSite({
    siteSlug: body.siteSlug,
    blueprint: body.blueprint,
    brandName: body.brandName,
    locale: body.locale,
    businessMode: body.businessMode,
    nichePreset: body.nichePreset,
    nichePrompt: body.nichePrompt,
    primaryNiche: body.primaryNiche,
    categoryLabels: body.categoryLabels,
    seedTopicLabels: body.seedTopicLabels,
    themeTone: body.themeTone,
    themeRecipe: body.themeRecipe,
    applyCmsMutations: body.applyCmsMutations,
    sanityProjectId: body.sanityProjectId,
    sanityDataset: body.sanityDataset,
    sanityApiVersion: body.sanityApiVersion,
    sanityReadToken: body.sanityReadToken,
    sanityWriteToken: body.sanityWriteToken,
    studioUrl: body.studioUrl,
    ownerEmail: body.ownerEmail,
    force: body.force
  });
  if (!result.ok) return reply.code(400).send(result);

  const siteSlug = sanitizeSiteSlug(body.siteSlug);
  const ownerUser = await maybeProvisionOwnerAccess(siteSlug, body.ownerEmail);
  await maybeProvisionAdminAccess(siteSlug);
  const studioUrlPatch = typeof body.studioUrl === 'string' ? String(body.studioUrl).trim() : undefined;
  const settings = await portalStore.patchSiteSettings(siteSlug, {
    ...(studioUrlPatch !== undefined ? { studioUrl: studioUrlPatch } : {}),
    maxPublishesPerRun: 1
  });
  const entitlement = await portalStore.getEntitlementEffective(siteSlug);
  await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);

  return {
    ...result,
    ownerProvisioned: Boolean(ownerUser),
    ownerEmail: ownerUser?.email || null
  };
});

app.post('/api/factory/site/launch', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const body = (req.body || {}) as {
    siteSlug?: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    nichePrompt?: string;
    primaryNiche?: string;
    categoryLabels?: string[];
    seedTopicLabels?: string[];
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    topicCount?: number;
    topicStatus?: 'queued' | 'brief_ready' | 'generated' | 'skipped';
    topicSource?: 'suggest' | 'synthetic';
    replaceTopics?: boolean;
    applySanity?: boolean;
    runPrepopulate?: boolean;
    prepopulateTargetPublishedCount?: number;
    prepopulateBatchSize?: number;
    sanityProjectId?: string;
    sanityDataset?: string;
    sanityApiVersion?: string;
    sanityReadToken?: string;
    sanityWriteToken?: string;
    studioUrl?: string;
    ownerEmail?: string;
    force?: boolean;
  };
  if (!body.siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  }
  const result = await factoryOps.launchSite({
    siteSlug: body.siteSlug,
    blueprint: body.blueprint,
    brandName: body.brandName,
    locale: body.locale,
    businessMode: body.businessMode,
    nichePreset: body.nichePreset,
    nichePrompt: body.nichePrompt,
    primaryNiche: body.primaryNiche,
    categoryLabels: body.categoryLabels,
    seedTopicLabels: body.seedTopicLabels,
    themeTone: body.themeTone,
    themeRecipe: body.themeRecipe,
    topicCount: body.topicCount,
    topicStatus: body.topicStatus,
    topicSource: body.topicSource,
    replaceTopics: body.replaceTopics,
    applySanity: body.applySanity,
    runPrepopulate: body.runPrepopulate,
    prepopulateTargetPublishedCount: body.prepopulateTargetPublishedCount,
    prepopulateBatchSize: body.prepopulateBatchSize,
    sanityProjectId: body.sanityProjectId,
    sanityDataset: body.sanityDataset,
    sanityApiVersion: body.sanityApiVersion,
    sanityReadToken: body.sanityReadToken,
    sanityWriteToken: body.sanityWriteToken,
    studioUrl: body.studioUrl,
    ownerEmail: body.ownerEmail,
    force: body.force
  });
  if (!result.ok) return reply.code(400).send(result);

  const siteSlug = sanitizeSiteSlug(body.siteSlug);
  const ownerUser = await maybeProvisionOwnerAccess(siteSlug, body.ownerEmail);
  await maybeProvisionAdminAccess(siteSlug);
  const studioUrlPatch = typeof body.studioUrl === 'string' ? String(body.studioUrl).trim() : undefined;
  const settings = await portalStore.patchSiteSettings(siteSlug, {
    ...(studioUrlPatch !== undefined ? { studioUrl: studioUrlPatch } : {}),
    maxPublishesPerRun: 1
  });
  const entitlement = await portalStore.getEntitlementEffective(siteSlug);
  await siteRuntime.syncSiteSettingsToSanity(siteSlug, settings, entitlement);

  return {
    ...result,
    ownerProvisioned: Boolean(ownerUser),
    ownerEmail: ownerUser?.email || null
  };
});

app.post('/api/factory/site/seed-cms', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const body = (req.body || {}) as { siteSlug?: string; apply?: boolean };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.seedCms({ siteSlug: body.siteSlug, apply: body.apply });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/discover-topics', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const body = (req.body || {}) as {
    siteSlug?: string;
    count?: number;
    status?: 'queued' | 'brief_ready' | 'generated' | 'skipped';
    source?: 'suggest' | 'synthetic';
    replace?: boolean;
    apply?: boolean;
  };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.discoverTopics({
    siteSlug: body.siteSlug,
    count: body.count,
    status: body.status,
    source: body.source,
    replace: body.replace,
    apply: body.apply
  });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/prepopulate', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const body = (req.body || {}) as { siteSlug?: string; targetPublishedCount?: number; batchSize?: number };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.prepopulate({
    siteSlug: body.siteSlug,
    targetPublishedCount: body.targetPublishedCount,
    batchSize: body.batchSize
  });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/handoff-pack', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const body = (req.body || {}) as { siteSlug?: string };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.handoffPack({ siteSlug: body.siteSlug });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const body = (req.body || {}) as {
    siteSlug?: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    nichePrompt?: string;
    primaryNiche?: string;
    categoryLabels?: string[];
    seedTopicLabels?: string[];
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    applyCmsMutations?: boolean;
    sanityProjectId?: string;
    sanityDataset?: string;
    sanityApiVersion?: string;
    sanityReadToken?: string;
    sanityWriteToken?: string;
    studioUrl?: string;
    ownerEmail?: string;
    force?: boolean;
  };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.createSite(body as {
    siteSlug: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    nichePrompt?: string;
    primaryNiche?: string;
    categoryLabels?: string[];
    seedTopicLabels?: string[];
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    applyCmsMutations?: boolean;
    sanityProjectId?: string;
    sanityDataset?: string;
    sanityApiVersion?: string;
    sanityReadToken?: string;
    sanityWriteToken?: string;
    studioUrl?: string;
    ownerEmail?: string;
    force?: boolean;
  });
  if (!result.ok) return reply.code(400).send(result);
  const siteSlug = sanitizeSiteSlug(body.siteSlug);
  const ownerUser = await maybeProvisionOwnerAccess(siteSlug, body.ownerEmail);
  await maybeProvisionAdminAccess(siteSlug);
  return {
    ...result,
    ownerProvisioned: Boolean(ownerUser),
    ownerEmail: ownerUser?.email || null
  };
});

app.post('/v1/factory/sites/:id/provision', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const params = req.params as { id: string };
  const result = await factoryOps.createSite({ siteSlug: params.id, force: false });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites/:id/seed', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const params = req.params as { id: string };
  const body = (req.body || {}) as { apply?: boolean };
  const result = await factoryOps.seedCms({ siteSlug: params.id, apply: body.apply });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites/:id/deploy', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const params = req.params as { id: string };
  const result = await factoryOps.handoffPack({ siteSlug: params.id });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites/:id/export-handoff', async (req, reply) => {
  if (!requireFactoryAccess(req, reply)) return;
  const params = req.params as { id: string };
  const result = await factoryOps.handoffPack({ siteSlug: params.id });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.get('/ops/factory', async (req, reply) => {
  if (!requireFactoryUiAccess(req, reply)) return;
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Factory Ops</title>
  ${portalBrandLogoSrc ? `<link rel="icon" type="image/png" href="${portalBrandLogoSrc}" />` : ''}
  <style>
    :root { --bg:#0f1115; --panel:#171b22; --line:#283140; --text:#e8edf7; --muted:#9ea8b8; --accent:#6cb5ff; --ok:#44d19a; --warn:#ffcc66; --err:#ff6b6b; }
    body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);max-width:1100px;margin:16px auto;padding:0 16px;}
    h1,h2{margin:0 0 8px;}
    .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;}
    .panel{grid-column:span 12;border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:14px;}
    .col-6{grid-column:span 6;}
    .col-4{grid-column:span 4;}
    .col-3{grid-column:span 3;}
    .col-12{grid-column:span 12;}
    label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px;}
    input,select,textarea,button{width:100%;box-sizing:border-box;background:#0f131a;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px 10px;}
    textarea{resize:vertical;min-height:120px;font:inherit;line-height:1.45;}
    button{cursor:pointer;font-weight:600;}
    button.primary{background:var(--accent);color:#041526;border-color:transparent;}
    button.secondary{background:#1f2733;}
    .row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px;margin-bottom:10px;}
    .hint{font-size:12px;color:var(--muted);}
    .toggles{display:flex;gap:14px;flex-wrap:wrap;}
    .toggle{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text);}
    .toggle input{width:auto;}
    pre{margin:0;background:#0a0f15;color:#d0e7ff;border:1px solid #223049;padding:12px;overflow:auto;border-radius:10px;min-height:56px;max-height:220px;}
    details{margin-top:10px;}
    summary{cursor:pointer;color:var(--muted);font-size:12px;}
    .response-line{padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:#0f131a;color:#d0e7ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}
    .guide{display:grid;gap:12px;}
    .guide-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;}
    .guide-card{grid-column:span 12;border:1px solid var(--line);border-radius:10px;background:#11161e;padding:12px;}
    .guide-card.half{grid-column:span 6;}
    .guide-card h3{margin:0 0 8px;font-size:15px;}
    .guide-card p{margin:0 0 8px;}
    .guide-card ol{margin:8px 0 0 18px;padding:0;}
    .guide-card li+li{margin-top:6px;}
    .code{margin:8px 0 0;background:#0a0f15;color:#d0e7ff;border:1px solid #223049;padding:12px;overflow:auto;border-radius:10px;white-space:pre-wrap;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;}
    .mini{font-size:12px;color:var(--muted);}
    .pill{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;border:1px solid var(--line);background:#0f131a;color:var(--muted);font-size:11px;margin-right:6px;}
    .status{font-size:12px;color:var(--muted);}
    .status.ok{color:var(--ok);}
    .status.err{color:var(--err);}
    @media (max-width: 900px){
      .col-6,.col-4,.col-3{grid-column:span 12;}
      .guide-card.half{grid-column:span 12;}
    }
  </style>
</head>
<body>
  <h1>Factory Ops</h1>
  <p class="hint">Pannello interno: crea un nuovo sito con un click (create + seed + discover + handoff), con bootstrap editoriale manuale e prepopulate opzionale.</p>
  <div class="grid">
    <section class="panel">
      <h2>Launch Site</h2>
      <div class="row">
        <div class="col-4">
          <label>Factory API secret</label>
          <input id="factorySecret" type="password" autocomplete="off" placeholder="Required" />
        </div>
        <div class="col-4">
          <label>Site slug</label>
          <input id="siteSlug" value="new-site" />
        </div>
        <div class="col-4">
          <label>Brand name</label>
          <input id="brandName" placeholder="My Brand" />
        </div>
        <div class="col-4">
          <label>Locale</label>
          <input id="locale" value="en-US" />
        </div>
      </div>
      <div class="row">
        <div class="col-4">
          <label>Business mode</label>
          <select id="businessMode">
            <option value="transfer_first">transfer_first</option>
            <option value="managed">managed</option>
          </select>
        </div>
        <div class="col-4">
          <label>Primary niche</label>
          <input id="primaryNiche" placeholder="Artificial Intelligence" />
        </div>
        <div class="col-4">
          <label>Theme tone</label>
          <select id="themeTone">
            <option value="auto">auto</option>
            <option value="editorial">editorial</option>
            <option value="luxury">luxury</option>
            <option value="wellness">wellness</option>
            <option value="playful">playful</option>
            <option value="technical">technical</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="col-4">
          <label>Niche prompt</label>
          <textarea id="nichePrompt" rows="10" placeholder="Describe the editorial niche, content scope, angles, tone, and exclusions."></textarea>
        </div>
        <div class="col-4">
          <label>Categories (one per line)</label>
          <textarea id="categoryLabels" rows="6" placeholder="AI News&#10;AI Tools & Platforms&#10;Use Cases & Industry Insights"></textarea>
        </div>
        <div class="col-4">
          <label>Seed topics (one per line)</label>
          <textarea id="seedTopicLabels" rows="6" placeholder="AI tools comparison&#10;AI trends and developments&#10;Practical AI applications"></textarea>
        </div>
      </div>
      <div class="row">
        <div class="col-3">
          <label>Theme recipe</label>
          <select id="themeRecipe">
            <option value="">(auto)</option>
            <option value="bold_magazine">bold_magazine</option>
            <option value="editorial_luxury">editorial_luxury</option>
            <option value="warm_wellness">warm_wellness</option>
            <option value="playful_kids">playful_kids</option>
            <option value="technical_minimal">technical_minimal</option>
            <option value="noir_luxury_dark">noir_luxury_dark</option>
            <option value="midnight_wellness_dark">midnight_wellness_dark</option>
            <option value="arcade_play_dark">arcade_play_dark</option>
          </select>
        </div>
        <div class="col-3">
          <label>Topic count</label>
          <input id="topicCount" type="number" value="60" min="1" />
        </div>
        <div class="col-3">
          <label>Topic source</label>
          <select id="topicSource">
            <option value="suggest">suggest</option>
            <option value="synthetic">synthetic</option>
          </select>
        </div>
        <div class="col-3">
          <label>Topic status</label>
          <select id="topicStatus">
            <option value="brief_ready">brief_ready</option>
            <option value="queued">queued</option>
            <option value="generated">generated</option>
            <option value="skipped">skipped</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="col-4">
          <label>Prepopulate target published</label>
          <input id="prepopulateTargetPublishedCount" type="number" value="30" min="1" />
        </div>
        <div class="col-4">
          <label>Prepopulate batch size</label>
          <input id="prepopulateBatchSize" type="number" value="3" min="1" />
        </div>
        <div class="col-4">
          <label>Owner email (portal)</label>
          <input id="ownerEmail" type="email" placeholder="owner@example.com" />
        </div>
      </div>
      <div class="row">
        <div class="col-3">
          <label>Sanity project ID</label>
          <input id="sanityProjectId" placeholder="projectId" />
        </div>
        <div class="col-3">
          <label>Sanity dataset</label>
          <input id="sanityDataset" value="production" />
        </div>
        <div class="col-3">
          <label>Sanity API version</label>
          <input id="sanityApiVersion" value="2025-01-01" />
        </div>
        <div class="col-3">
          <label>Studio URL</label>
          <input id="studioUrl" placeholder="https://studio.example.com" />
        </div>
      </div>
      <div class="row">
        <div class="col-6">
          <label>Sanity READ token</label>
          <input id="sanityReadToken" type="password" autocomplete="off" />
        </div>
        <div class="col-6">
          <label>Sanity WRITE token</label>
          <input id="sanityWriteToken" type="password" autocomplete="off" />
        </div>
      </div>
      <div class="row">
        <div class="col-12 toggles">
          <label class="toggle"><input id="applySanity" type="checkbox" checked /> Apply Sanity mutations</label>
          <label class="toggle"><input id="runPrepopulate" type="checkbox" /> Run prepopulate</label>
          <label class="toggle"><input id="replaceTopics" type="checkbox" checked /> Replace topic candidates</label>
          <label class="toggle"><input id="force" type="checkbox" /> Force overwrite existing site</label>
        </div>
      </div>
      <div class="row">
        <div class="col-4"><button id="launchBtn" class="primary">Launch Site (One Click)</button></div>
        <div class="col-4"><button id="createBtn" class="secondary">Create Only</button></div>
        <div class="col-4"><button id="statusBtn" class="secondary">Check Status</button></div>
      </div>
      <p id="status" class="status">Ready.</p>
    </section>
    <section class="panel">
      <h2>Result</h2>
      <div id="resultSummary" class="response-line">Ready.</div>
      <details>
        <summary>Raw response</summary>
        <pre id="out">Ready</pre>
      </details>
    </section>
    <section class="panel">
      <h2>Complete Deploy</h2>
      <div id="guide" class="guide">
        <p class="hint">Launch or check a site to see the exact next steps, Vercel env values, and Studio deploy command.</p>
      </div>
    </section>
  </div>
  <script>
    const out = document.getElementById('out');
    const resultSummary = document.getElementById('resultSummary');
    const status = document.getElementById('status');
    const guide = document.getElementById('guide');
    const FACTORY_SECRET_STORAGE_KEY = 'factory_api_secret';
    let latestResponseData = null;
    let latestStatusData = null;

    function getValue(id) {
      const el = document.getElementById(id);
      if (!el) return '';
      if (el.type === 'checkbox') return Boolean(el.checked);
      return String(el.value || '').trim();
    }

    function getMultilineValues(id) {
      return String(getValue(id) || '')
        .split(/\\r?\\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    function setStatus(message, type) {
      status.textContent = message;
      status.className = 'status' + (type ? ' ' + type : '');
    }

    function parseJsonSafe(text) {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    function summarizeResponse(text, payload) {
      if (payload && typeof payload === 'object') {
        if (payload.ok === true) {
          const siteSlug = payload.siteSlug || payload.input?.siteSlug || getValue('siteSlug') || '';
          return siteSlug ? ('Completed for ' + siteSlug) : 'Completed.';
        }
        if (payload.ok === false) {
          return 'Failed: ' + String(payload.step || payload.error || 'Request failed');
        }
      }
      const firstLine = String(text || '').split(/\\r?\\n/).find(Boolean) || 'Ready.';
      return firstLine.slice(0, 220);
    }

    function shellEscape(value) {
      return JSON.stringify(String(value || ''));
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function buildGuideData() {
      const deploy = latestStatusData && latestStatusData.deploy ? latestStatusData.deploy : {};
      const vercelEnv = deploy.vercelEnv || {};
      const studioDeploy = deploy.studioDeploy || {};
      const siteSlug = String(vercelEnv.SITE_SLUG || getValue('siteSlug') || '').trim();
      const brandName = String(vercelEnv.NEXT_PUBLIC_SITE_NAME || getValue('brandName') || '').trim();
      const projectId = String(vercelEnv.SANITY_PROJECT_ID || getValue('sanityProjectId') || '').trim();
      const dataset = String(vercelEnv.SANITY_DATASET || getValue('sanityDataset') || 'production').trim();
      const apiVersion = String(vercelEnv.SANITY_API_VERSION || getValue('sanityApiVersion') || '2025-01-01').trim();
      const readToken = String(vercelEnv.SANITY_READ_TOKEN || getValue('sanityReadToken') || '').trim();
      const siteDescription = String(vercelEnv.NEXT_PUBLIC_SITE_DESCRIPTION || '').trim();
      const revalidateSecret = String(vercelEnv.REVALIDATE_SECRET || '').trim();
      const portalBaseUrl = String(vercelEnv.NEXT_PUBLIC_PORTAL_BASE_URL || 'https://aiblogs.earningsites.net').trim();
      const blueprintPath = String(vercelEnv.SITE_BLUEPRINT_PATH || ('../../sites/' + siteSlug + '/site.blueprint.json')).trim();
      const contentDriver = String(vercelEnv.CONTENT_REPOSITORY_DRIVER || 'sanity').trim() || 'sanity';
      const suggestedStudioUrl = String(studioDeploy.suggestedUrl || ('https://' + siteSlug + '.sanity.studio')).trim();
      const studioHostname = String(studioDeploy.hostname || siteSlug).trim() || siteSlug;

      const vercelEnvText = [
        'SITE_SLUG=' + siteSlug,
        'NEXT_PUBLIC_SITE_SLUG=' + siteSlug,
        'SANITY_STUDIO_SITE_SLUG=' + siteSlug,
        'SITE_BLUEPRINT_PATH=' + blueprintPath,
        '',
        'CONTENT_REPOSITORY_DRIVER=' + contentDriver,
        'SANITY_PROJECT_ID=' + projectId,
        'SANITY_DATASET=' + dataset,
        'SANITY_API_VERSION=' + apiVersion,
        'SANITY_READ_TOKEN=' + readToken,
        '',
        'NEXT_PUBLIC_SITE_NAME=' + brandName,
        'NEXT_PUBLIC_SITE_DESCRIPTION=' + siteDescription,
        'NEXT_PUBLIC_PORTAL_BASE_URL=' + portalBaseUrl,
        'REVALIDATE_SECRET=' + revalidateSecret,
        'NEXT_PUBLIC_SITE_URL=https://<set-after-first-vercel-deploy>'
      ].join('\\n');

      const studioCommand = [
        'env \\\\',
        '  SANITY_STUDIO_PROJECT_ID=' + projectId + ' \\\\',
        '  SANITY_STUDIO_DATASET=' + dataset + ' \\\\',
        '  SANITY_STUDIO_SITE_SLUG=' + siteSlug + ' \\\\',
        '  SANITY_STUDIO_HOSTNAME=' + studioHostname + ' \\\\',
        '  npm --workspace @autoblog/studio run deploy -- --yes'
      ].join('\\n');

      const studioLinkCommand = [
        'npm run site:studio:prod -- ' + shellEscape(siteSlug) + ' \\\\',
        '  --studio-url ' + shellEscape(suggestedStudioUrl)
      ].join('\\n');

      const pullCommand = 'npm run site:pull -- ' + shellEscape(siteSlug);
      const vercelDomainHint = 'After the first deploy, set NEXT_PUBLIC_SITE_URL to the stable production domain assigned by Vercel and redeploy.';
      const studioHint = 'After deploy, the expected Studio URL is ' + suggestedStudioUrl + '. If the hostname is unavailable, deploy again with a different SANITY_STUDIO_HOSTNAME.';
      const studioPortalHint = 'Then register that URL in the production runtime and portal settings with the command below. Optional: mirror it into Vercel as SANITY_STUDIO_URL if you want the site-domain /admin/studio fallback to know the Studio URL too.';

      return {
        siteSlug,
        pullCommand,
        vercelEnvText,
        studioCommand,
        studioLinkCommand,
        vercelDomainHint,
        studioHint,
        studioPortalHint,
        suggestedStudioUrl
      };
    }

    function renderGuide() {
      const data = buildGuideData();
      if (!data.siteSlug) {
        guide.innerHTML = '<p class="hint">Launch or check a site to see the exact next steps, Vercel env values, and Studio deploy command.</p>';
        return;
      }

      guide.innerHTML = [
        '<div class="guide-grid">',
        '  <section class="guide-card">',
        '    <h3>Recommended Flow</h3>',
        '    <span class="pill">' + escapeHtml(data.siteSlug) + '</span>',
        '    <ol>',
        '      <li>Pull the site locally and inspect it in Studio before public deploy.</li>',
        '      <li>Commit new blueprint on <code>main</code> before Vercel deploy.</li>',
        '      <li>Create a new Vercel project from the monorepo with <strong>Root Directory = apps/web</strong> and paste the env block below.</li>',
        '      <li>After the first Vercel deploy, replace <code>NEXT_PUBLIC_SITE_URL</code> with the stable production domain and redeploy.</li>',
        '      <li>Deploy the Sanity Studio with the command below.</li>',
        '      <li>When Studio is live, register <code>' + escapeHtml(data.suggestedStudioUrl) + '</code> in the production runtime so the portal links to it.</li>',
        '    </ol>',
        '    <div class="code">' + escapeHtml(data.pullCommand) + '</div>',
        '  </section>',
        '  <section class="guide-card half">',
        '    <h3>Vercel Env</h3>',
        '    <p class="mini">Project: same repo, Framework = Next.js, Root Directory = <code>apps/web</code>.</p>',
        '    <div class="code">' + escapeHtml(data.vercelEnvText) + '</div>',
        '    <p class="mini">' + escapeHtml(data.vercelDomainHint) + '</p>',
        '  </section>',
        '  <section class="guide-card half">',
        '    <h3>Studio Deploy</h3>',
        '    <p class="mini">Run this from the repo root on your local machine. Your Sanity CLI login or <code>SANITY_AUTH_TOKEN</code> must already be valid.</p>',
        '    <div class="code">' + escapeHtml(data.studioCommand) + '</div>',
        '    <p class="mini">' + escapeHtml(data.studioHint) + '</p>',
        '  </section>',
        '  <section class="guide-card half">',
        '    <h3>Attach Studio To Portal</h3>',
        '    <p class="mini">This updates the production site runtime and portal settings without touching owner, billing, or handoff state.</p>',
        '    <div class="code">' + escapeHtml(data.studioLinkCommand) + '</div>',
        '    <p class="mini">' + escapeHtml(data.studioPortalHint) + '</p>',
        '  </section>',
        '</div>'
      ].join('');
    }

    async function loadSiteStatus(siteSlug) {
      const secret = getFactorySecret();
      if (!siteSlug || !secret) return;
      const res = await fetch('/api/factory/site/' + encodeURIComponent(siteSlug) + '/status', {
        headers: { 'x-factory-secret': secret }
      });
      const text = await res.text();
      const data = parseJsonSafe(text);
      if (res.ok && data) {
        latestStatusData = data;
        renderGuide();
      }
    }

    function buildPayload() {
      const payload = {
        siteSlug: getValue('siteSlug'),
        brandName: getValue('brandName') || undefined,
        locale: getValue('locale') || undefined,
        businessMode: getValue('businessMode') || undefined,
        primaryNiche: getValue('primaryNiche') || undefined,
        nichePrompt: getValue('nichePrompt') || undefined,
        categoryLabels: getMultilineValues('categoryLabels'),
        seedTopicLabels: getMultilineValues('seedTopicLabels'),
        themeTone: getValue('themeTone') || undefined,
        themeRecipe: getValue('themeRecipe') || undefined,
        topicCount: Number(getValue('topicCount') || 60),
        topicSource: getValue('topicSource') || 'suggest',
        topicStatus: getValue('topicStatus') || 'brief_ready',
        applySanity: Boolean(getValue('applySanity')),
        runPrepopulate: Boolean(getValue('runPrepopulate')),
        replaceTopics: Boolean(getValue('replaceTopics')),
        prepopulateTargetPublishedCount: Number(getValue('prepopulateTargetPublishedCount') || 30),
        prepopulateBatchSize: Number(getValue('prepopulateBatchSize') || 3),
        sanityProjectId: getValue('sanityProjectId') || undefined,
        sanityDataset: getValue('sanityDataset') || undefined,
        sanityApiVersion: getValue('sanityApiVersion') || undefined,
        sanityReadToken: getValue('sanityReadToken') || undefined,
        sanityWriteToken: getValue('sanityWriteToken') || undefined,
        studioUrl: getValue('studioUrl') || undefined,
        ownerEmail: getValue('ownerEmail') || undefined,
        force: Boolean(getValue('force'))
      };
      if (!payload.themeRecipe) delete payload.themeRecipe;
      if (!payload.brandName) delete payload.brandName;
      if (!payload.locale) delete payload.locale;
      if (!payload.primaryNiche) delete payload.primaryNiche;
      if (!payload.nichePrompt) delete payload.nichePrompt;
      if (!payload.categoryLabels.length) delete payload.categoryLabels;
      if (!payload.seedTopicLabels.length) delete payload.seedTopicLabels;
      if (!payload.sanityProjectId) delete payload.sanityProjectId;
      if (!payload.sanityDataset) delete payload.sanityDataset;
      if (!payload.sanityApiVersion) delete payload.sanityApiVersion;
      if (!payload.sanityReadToken) delete payload.sanityReadToken;
      if (!payload.sanityWriteToken) delete payload.sanityWriteToken;
      if (!payload.studioUrl) delete payload.studioUrl;
      if (!payload.ownerEmail) delete payload.ownerEmail;
      return payload;
    }

    function getFactorySecret() {
      const fromInput = getValue('factorySecret');
      if (fromInput) {
        try { localStorage.setItem(FACTORY_SECRET_STORAGE_KEY, fromInput); } catch {}
        return fromInput;
      }
      try {
        return String(localStorage.getItem(FACTORY_SECRET_STORAGE_KEY) || '').trim();
      } catch {
        return '';
      }
    }

    async function callApi(path, payload) {
      const secret = getFactorySecret();
      if (!secret) {
        setStatus('Factory API secret is required.', 'err');
        out.textContent = 'Missing factory secret (x-factory-secret).';
        resultSummary.textContent = 'Missing factory secret (x-factory-secret).';
        return;
      }
      setStatus('Running...', '');
      out.textContent = 'Running...';
      resultSummary.textContent = 'Running...';
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-factory-secret': secret
        },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      const data = parseJsonSafe(text);
      latestResponseData = data;
      out.textContent = text;
      resultSummary.textContent = summarizeResponse(text, data);
      if (res.ok) {
        setStatus('Completed.', 'ok');
        await loadSiteStatus(payload.siteSlug);
      } else {
        setStatus('Failed. Check output.', 'err');
      }
    }

    document.getElementById('launchBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const payload = buildPayload();
      if (!payload.siteSlug) {
        setStatus('siteSlug is required.', 'err');
        return;
      }
      await callApi('/api/factory/site/launch', payload);
    });

    document.getElementById('createBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const payload = buildPayload();
      if (!payload.siteSlug) {
        setStatus('siteSlug is required.', 'err');
        return;
      }
      payload.applyCmsMutations = payload.applySanity;
      await callApi('/api/factory/site/create', payload);
    });

    document.getElementById('statusBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const siteSlug = getValue('siteSlug');
      const secret = getFactorySecret();
      if (!siteSlug) {
        setStatus('siteSlug is required.', 'err');
        return;
      }
      if (!secret) {
        setStatus('Factory API secret is required.', 'err');
        out.textContent = 'Missing factory secret (x-factory-secret).';
        return;
      }
      setStatus('Loading status...', '');
      const res = await fetch('/api/factory/site/' + encodeURIComponent(siteSlug) + '/status', {
        headers: { 'x-factory-secret': secret }
      });
      const text = await res.text();
      const data = parseJsonSafe(text);
      latestStatusData = data;
      out.textContent = text;
      resultSummary.textContent = summarizeResponse(text, data);
      renderGuide();
      setStatus(res.ok ? 'Status loaded.' : 'Status request failed.', res.ok ? 'ok' : 'err');
    });

    (async () => {
      const secret = getFactorySecret();
      if (secret) {
        const secretInput = document.getElementById('factorySecret');
        if (secretInput) secretInput.value = secret;
      }
      if (!secret) return;
      try {
        const res = await fetch('/api/factory/options', {
          headers: { 'x-factory-secret': secret }
        });
        if (!res.ok) return;
        const data = await res.json();
      } catch {}
      renderGuide();
    })();
  </script>
</body>
</html>`;
  return reply.type('text/html').send(html);
});

const port = Number(process.env.ENGINE_PORT || 8787);
const host = process.env.ENGINE_HOST || '0.0.0.0';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
