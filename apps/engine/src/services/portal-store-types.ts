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
  pendingPlan: '' | 'base' | 'standard' | 'pro';
  pendingMonthlyQuota: number;
  pendingEffectiveAt: string;
  pendingStripePriceId: string;
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
