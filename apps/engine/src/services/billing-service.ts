import crypto from 'node:crypto';
import type { PortalStoreAdapter } from './portal-store-adapter';
import {
  comparePlanRank,
  getCurrentMonthWindow,
  getQuotaForPlan,
  normalizePlan,
  planFromPriceId,
  priceIdForPlan,
  type SubscriptionPlan
} from '../config/plans';

type StripeWebhookPayload = {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

type PlanChangeMode = 'upgrade' | 'downgrade' | 'lateral';

function normalizeStripeStatus(status: string | undefined | null): 'trial' | 'active' | 'overdue' | 'canceled' {
  const value = String(status || '').toLowerCase();
  if (value === 'active' || value === 'trialing') return 'active';
  if (value === 'past_due' || value === 'unpaid') return 'overdue';
  if (value === 'canceled' || value === 'incomplete_expired') return 'canceled';
  return 'trial';
}

function parseSignatureHeader(signatureHeader: string | undefined) {
  const output: { timestamp: string; signatures: string[] } = { timestamp: '', signatures: [] };
  if (!signatureHeader) return output;

  const parts = signatureHeader.split(',').map((entry) => entry.trim());
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    if (key === 't') output.timestamp = value;
    if (key === 'v1') output.signatures.push(value);
  }

  return output;
}

function verifyStripeSignature(rawBody: string, signatureHeader: string | undefined, secret: string) {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed.timestamp || !parsed.signatures.length) return false;

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  for (const signature of parsed.signatures) {
    try {
      if (
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
      ) {
        return true;
      }
    } catch {
      // ignore malformed signature chunks
    }
  }

  return false;
}

function extractSiteSlugFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return '';
  const record = metadata as Record<string, unknown>;
  return String(record.siteSlug || record.site_slug || '').trim().toLowerCase();
}

function epochToIso(epochSeconds: unknown): string {
  const raw = Number(epochSeconds);
  if (!Number.isFinite(raw) || raw <= 0) return '';
  return new Date(raw * 1000).toISOString();
}

export class BillingService {
  constructor(private readonly store: PortalStoreAdapter) {}

  private getSecretKey() {
    return String(process.env.STRIPE_SECRET_KEY || '').trim();
  }

  private async stripeRequest(path: string, body?: URLSearchParams) {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const response = await fetch(`https://api.stripe.com${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
      },
      body: body ? body.toString() : undefined
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Stripe API ${response.status}: ${text}`);
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async createCustomerPortalSession(input: { siteSlug: string; customerId: string; returnUrl: string }) {
    const params = new URLSearchParams();
    params.set('customer', input.customerId);
    params.set('return_url', input.returnUrl);

    const response = await this.stripeRequest('/v1/billing_portal/sessions', params);
    return {
      url: String(response.url || '')
    };
  }

  async createCheckoutSession(input: {
    siteSlug: string;
    customerId: string;
    plan: SubscriptionPlan;
    successUrl: string;
    cancelUrl: string;
  }) {
    const priceId = priceIdForPlan(input.plan);
    if (!priceId) {
      throw new Error(`Stripe price id not configured for plan "${input.plan}"`);
    }

    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('customer', input.customerId);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', input.successUrl);
    params.set('cancel_url', input.cancelUrl);
    params.set('allow_promotion_codes', 'true');
    params.set('subscription_data[metadata][siteSlug]', input.siteSlug);
    params.set('subscription_data[metadata][plan]', input.plan);

    const response = await this.stripeRequest('/v1/checkout/sessions', params);
    return {
      url: String(response.url || ''),
      sessionId: String(response.id || ''),
      priceId
    };
  }

  async updateExistingSubscriptionPlan(input: {
    siteSlug: string;
    subscriptionId: string;
    plan: SubscriptionPlan;
    changeMode: PlanChangeMode;
  }) {
    const priceId = priceIdForPlan(input.plan);
    if (!priceId) {
      throw new Error(`Stripe price id not configured for plan "${input.plan}"`);
    }

    const currentSubscription = await this.stripeRequest(
      `/v1/subscriptions/${encodeURIComponent(String(input.subscriptionId || '').trim())}`
    );
    const currentStatus = String(currentSubscription.status || '').toLowerCase();
    if (currentStatus === 'canceled' || currentStatus === 'incomplete_expired') {
      throw new Error(`STRIPE_SUBSCRIPTION_NOT_UPDATABLE:${currentStatus}`);
    }
    const currentDetails = this.resolveSubscriptionCore(currentSubscription);

    const items = (currentSubscription.items as { data?: Array<Record<string, unknown>> } | undefined)?.data || [];
    const firstItem = items[0] || {};
    const subscriptionItemId = String(firstItem.id || '');
    if (!subscriptionItemId) {
      throw new Error('Stripe subscription has no updatable items');
    }

    if (currentDetails.priceId && currentDetails.priceId === priceId) {
      return {
        noChange: true,
        changeMode: input.changeMode,
        plan: currentDetails.plan,
        priceId: currentDetails.priceId,
        customerId: currentDetails.customerId,
        subscriptionId: currentDetails.subscriptionId,
        billingStatus: currentDetails.billingStatus,
        currentPeriodStart: currentDetails.currentPeriodStart,
        currentPeriodEnd: currentDetails.currentPeriodEnd
      };
    }

    const prorationBehaviorRaw = String(process.env.STRIPE_PRORATION_BEHAVIOR || 'always_invoice').trim();
    const prorationBehavior =
      input.changeMode === 'downgrade'
        ? 'none'
        : prorationBehaviorRaw === 'none' || prorationBehaviorRaw === 'create_prorations'
          ? prorationBehaviorRaw
          : 'always_invoice';

    const params = new URLSearchParams();
    params.set('items[0][id]', subscriptionItemId);
    params.set('items[0][price]', priceId);
    params.set('proration_behavior', prorationBehavior);
    params.set('payment_behavior', 'allow_incomplete');
    params.set('metadata[siteSlug]', input.siteSlug);
    params.set('metadata[plan]', input.plan);

    const updated = await this.stripeRequest(
      `/v1/subscriptions/${encodeURIComponent(String(input.subscriptionId || '').trim())}`,
      params
    );
    const details = this.resolveSubscriptionCore(updated);

    return {
      noChange: false,
      changeMode: input.changeMode,
      plan: details.plan,
      priceId: details.priceId,
      customerId: details.customerId,
      subscriptionId: details.subscriptionId,
      billingStatus: details.billingStatus,
      currentPeriodStart: details.currentPeriodStart,
      currentPeriodEnd: details.currentPeriodEnd
    };
  }

  async findUpdatableSubscriptionForCustomer(customerId: string) {
    const normalizedCustomerId = String(customerId || '').trim();
    if (!normalizedCustomerId) return null;

    const response = await this.stripeRequest(
      `/v1/subscriptions?customer=${encodeURIComponent(normalizedCustomerId)}&status=all&limit=25`
    );
    const list = Array.isArray(response.data) ? (response.data as Array<Record<string, unknown>>) : [];
    if (!list.length) return null;

    const allowedStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid']);
    const candidates = list
      .filter((subscription) => allowedStatuses.has(String(subscription.status || '').toLowerCase()))
      .sort((a, b) => Number(b.created || 0) - Number(a.created || 0));

    const selected = candidates[0];
    if (!selected) return null;

    const details = this.resolveSubscriptionCore(selected);
    return {
      ...details,
      status: String(selected.status || '')
    };
  }

  async createCustomer(input: { email: string; siteSlug: string }) {
    const params = new URLSearchParams();
    params.set('email', input.email);
    params.set('metadata[siteSlug]', input.siteSlug);

    const response = await this.stripeRequest('/v1/customers', params);
    return {
      customerId: String(response.id || '')
    };
  }

  private resolveSubscriptionCore(object: Record<string, unknown>) {
    const metadata = (object.metadata || {}) as Record<string, unknown>;
    const siteSlug = extractSiteSlugFromMetadata(metadata);

    const items = (object.items as { data?: Array<Record<string, unknown>> } | undefined)?.data || [];
    const firstItem = items[0] || {};
    const price = (firstItem.price || {}) as Record<string, unknown>;
    const priceId = String(price.id || '');
    const plan = planFromPriceId(priceId) || normalizePlan(String(metadata.plan || 'base'));

    const customerId = String(object.customer || '');
    const subscriptionId = String(object.id || '');
    const status = normalizeStripeStatus(String(object.status || ''));
    const currentPeriodEnd = epochToIso(object.current_period_end);
    const currentPeriodStart = epochToIso(object.current_period_start);

    return {
      siteSlug,
      plan,
      priceId,
      customerId,
      subscriptionId,
      billingStatus: status,
      currentPeriodStart,
      currentPeriodEnd
    };
  }

  async processWebhook(rawBody: string, signatureHeader: string | undefined) {
    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
      throw new Error('Invalid Stripe webhook signature');
    }

    const payload = JSON.parse(rawBody) as StripeWebhookPayload;
    const eventId = String(payload.id || '');
    const type = String(payload.type || '');
    const object = (payload.data?.object || {}) as Record<string, unknown>;

    if (!eventId || !type) {
      return { ok: true, ignored: true, reason: 'Missing event id/type' };
    }

    if (await this.store.isWebhookEventProcessed(eventId)) {
      return { ok: true, duplicate: true, eventId, type };
    }

    if (
      type === 'checkout.session.completed' ||
      type === 'customer.subscription.updated' ||
      type === 'customer.subscription.deleted'
    ) {
      const source = type === 'checkout.session.completed' && object.subscription
        ? (await this.stripeRequest(`/v1/subscriptions/${encodeURIComponent(String(object.subscription || ''))}`))
        : object;

      const details = this.resolveSubscriptionCore(source);
      if (!details.siteSlug) {
        await this.store.markWebhookEventProcessed(eventId);
        return { ok: true, ignored: true, eventId, type, reason: 'No siteSlug metadata' };
      }

      const current = await this.store.getEntitlementEffective(details.siteSlug);
      const window = getCurrentMonthWindow();
      const quota = getQuotaForPlan(details.plan);
      const status = type === 'customer.subscription.deleted' ? 'stopped' : 'active';
      const rankDelta = comparePlanRank(current.plan, details.plan);
      const isScheduledDowngradeEvent =
        type === 'customer.subscription.updated' &&
        rankDelta < 0 &&
        status === 'active';

      let entitlementResult;
      let planApplied = true;

      if (isScheduledDowngradeEvent) {
        entitlementResult = await this.store.patchEntitlement(details.siteSlug, {
          // Keep current access until cycle end
          plan: current.plan,
          monthlyQuota: current.monthlyQuota,
          periodStart: current.periodStart || window.periodStartIso,
          periodEnd: current.periodEnd || window.periodEndIso,
          pendingPlan: details.plan,
          pendingMonthlyQuota: quota,
          pendingEffectiveAt: details.currentPeriodEnd || current.periodEnd || window.periodEndIso,
          pendingStripePriceId: details.priceId,
          status: 'active',
          stripeCustomerId: details.customerId,
          stripeSubscriptionId: details.subscriptionId,
          stripePriceId: current.stripePriceId,
          billingStatus: details.billingStatus
        });
        planApplied = false;
      } else {
        entitlementResult = await this.store.patchEntitlement(details.siteSlug, {
          plan: details.plan,
          monthlyQuota: quota,
          periodStart: window.periodStartIso,
          periodEnd: window.periodEndIso,
          pendingPlan: '',
          pendingMonthlyQuota: 0,
          pendingEffectiveAt: '',
          pendingStripePriceId: '',
          status,
          stripeCustomerId: details.customerId,
          stripeSubscriptionId: details.subscriptionId,
          stripePriceId: details.priceId,
          billingStatus: details.billingStatus
        });
      }

      await this.store.markWebhookEventProcessed(eventId);
      return {
        ok: true,
        eventId,
        type,
        siteSlug: details.siteSlug,
        plan: entitlementResult.plan,
        monthlyQuota: entitlementResult.monthlyQuota,
        status,
        planApplied,
        pendingPlan: entitlementResult.pendingPlan,
        pendingEffectiveAt: entitlementResult.pendingEffectiveAt
      };
    }

    if (type === 'invoice.payment_failed') {
      const metadataSiteSlug = extractSiteSlugFromMetadata(object.metadata);
      if (metadataSiteSlug) {
        await this.store.patchEntitlement(metadataSiteSlug, {
          billingStatus: 'overdue'
        });
      }
      await this.store.markWebhookEventProcessed(eventId);
      return {
        ok: true,
        eventId,
        type,
        siteSlug: metadataSiteSlug || null,
        markedOverdue: Boolean(metadataSiteSlug)
      };
    }

    await this.store.markWebhookEventProcessed(eventId);
    return { ok: true, eventId, type, ignored: true };
  }
}
