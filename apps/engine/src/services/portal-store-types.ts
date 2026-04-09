import type { MonetizationPlacementTarget, SiteMonetizationSettings } from '@autoblog/factory-sdk';

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
  role: 'owner';
};

export type PortalSiteBillingMode = 'customer_paid' | 'incubating' | 'complimentary';

export type PortalSiteSettings = {
  siteSlug: string;
  publishingEnabled: boolean;
  maxPublishesPerRun: number;
  monetization: SiteMonetizationSettings;
  studioUrl: string;
  publicContactEmail: string;
  privacyPolicyOverride: string;
  cookiePolicyOverride: string;
  disclaimerOverride: string;
  updatedAt: string;
};

export type PortalSiteEntitlement = {
  siteSlug: string;
  plan: 'base' | 'standard' | 'pro';
  monthlyQuota: number;
  publishedThisMonth: number;
  periodStart: string;
  periodEnd: string;
  pendingPlan: '' | 'base' | 'standard' | 'pro';
  pendingMonthlyQuota: number;
  pendingEffectiveAt: string;
  pendingStripePriceId: string;
  status: 'active' | 'paused' | 'stopped';
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  billingMode: PortalSiteBillingMode;
  billingStatus: 'n/a' | 'trial' | 'active' | 'overdue' | 'canceled';
  updatedAt: string;
};

export type PortalSiteSummary = {
  siteSlug: string;
  role: 'owner';
  settings: PortalSiteSettings;
  entitlement: PortalSiteEntitlement;
};

export function emptyMonetizationSettings(): SiteMonetizationSettings {
  return {
    enabled: false,
    providerName: '',
    headHtml: '',
    placements: []
  };
}

export function normalizeMonetizationPlacementTarget(value: unknown): MonetizationPlacementTarget | null {
  const raw = String(value || '').trim();
  if (
    raw === 'homeLead' ||
    raw === 'homeMid' ||
    raw === 'categoryTop' ||
    raw === 'articleTop' ||
    raw === 'articleSidebar' ||
    raw === 'articleBottom'
  ) {
    return raw;
  }
  return null;
}

export function normalizeSiteMonetization(value: unknown): SiteMonetizationSettings {
  const fallback = emptyMonetizationSettings();
  if (!value || typeof value !== 'object') return fallback;

  const raw = value as Partial<SiteMonetizationSettings> & {
    placements?: Array<{ target?: unknown; html?: unknown }>;
  };

  const placements = Array.isArray(raw.placements)
    ? raw.placements
        .map((placement) => {
          const target = normalizeMonetizationPlacementTarget(placement?.target);
          const html = String(placement?.html || '').trim();
          if (!target || !html) return null;
          return { target, html };
        })
        .filter((placement): placement is SiteMonetizationSettings['placements'][number] => Boolean(placement))
    : [];

  return {
    enabled: Boolean(raw.enabled),
    providerName: String(raw.providerName || '').trim(),
    headHtml: String(raw.headHtml || '').trim(),
    placements
  };
}

export function hasMonetizationContent(monetization: SiteMonetizationSettings | null | undefined) {
  if (!monetization) return false;
  if (String(monetization.headHtml || '').trim()) return true;
  return monetization.placements.some((placement) => String(placement.html || '').trim());
}

export function normalizePortalSiteBillingMode(value: unknown): PortalSiteBillingMode {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'customer_paid' || raw === 'incubating' || raw === 'complimentary') {
    return raw;
  }
  return 'incubating';
}

export function normalizePortalSiteEntitlementStatus(value: unknown): PortalSiteEntitlement['status'] {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'paused' || raw === 'stopped' || raw === 'active') {
    return raw;
  }
  return 'active';
}

export function normalizePortalSiteBillingStatus(value: unknown): PortalSiteEntitlement['billingStatus'] {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'trial' || raw === 'active' || raw === 'overdue' || raw === 'canceled' || raw === 'n/a') {
    return raw;
  }
  return 'n/a';
}

export function isPortalSiteOperational(entitlement: PortalSiteEntitlement): boolean {
  if (entitlement.status !== 'active') return false;
  if (entitlement.billingMode !== 'customer_paid') return true;
  const billingHealthy = entitlement.billingStatus === 'active' || entitlement.billingStatus === 'trial';
  return billingHealthy && Boolean(String(entitlement.stripeSubscriptionId || '').trim());
}

export function isPortalSiteInactiveForOwner(entitlement: PortalSiteEntitlement): boolean {
  return entitlement.billingMode === 'customer_paid' && !isPortalSiteOperational(entitlement);
}
