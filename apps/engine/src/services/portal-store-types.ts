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
  adSlotsEnabled: boolean;
  adsMode: 'auto' | 'manual' | 'hybrid';
  adsPreviewEnabled: boolean;
  adsensePublisherId: string;
  adsenseSlotHeader: string;
  adsenseSlotInContent: string;
  adsenseSlotFooter: string;
  fallbackToPlatform: boolean;
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
