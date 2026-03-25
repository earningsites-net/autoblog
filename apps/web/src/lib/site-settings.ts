import { cache } from 'react';
import groq from 'groq';
import { hasSanityConfig, sanityClient } from './sanity';
import { siteConfig } from './site';

export type PublicSiteSettings = {
  siteSlug: string;
  adSlotsEnabled: boolean;
  adsMode: 'auto' | 'manual' | 'hybrid';
  adsPreviewEnabled: boolean;
  adsensePublisherId: string;
  adsenseSlotHeader: string;
  adsenseSlotInContent: string;
  adsenseSlotFooter: string;
  fallbackToPlatform: boolean;
  studioUrl: string;
  publishing: {
    mode: 'bulk_direct' | 'steady_scheduled';
    maxPublishesPerRun: number;
    planMonthlyQuota: number;
    publishedThisMonth: number;
    quotaPeriodStart: string;
    quotaPeriodEnd: string;
  };
  entitlement: {
    plan: 'base' | 'standard' | 'pro';
    monthlyQuota: number;
    publishedThisMonth: number;
    periodStart: string;
    periodEnd: string;
    status: 'active' | 'paused' | 'stopped';
    billingMode: 'customer_paid' | 'incubating' | 'complimentary';
    billingStatus: 'n/a' | 'trial' | 'active' | 'overdue' | 'canceled';
  };
};

function currentMonthWindow() {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    periodStartIso: periodStart.toISOString(),
    periodEndIso: periodEnd.toISOString()
  };
}

function defaultSettings(): PublicSiteSettings {
  const month = currentMonthWindow();
  return {
    siteSlug: siteConfig.slug,
    adSlotsEnabled: false,
    adsMode: 'auto',
    adsPreviewEnabled: true,
    adsensePublisherId: '',
    adsenseSlotHeader: '',
    adsenseSlotInContent: '',
    adsenseSlotFooter: '',
    fallbackToPlatform: true,
    studioUrl: process.env.SANITY_STUDIO_URL || '',
    publishing: {
      mode: 'steady_scheduled',
      maxPublishesPerRun: 1,
      planMonthlyQuota: 0,
      publishedThisMonth: 0,
      quotaPeriodStart: month.periodStartIso,
      quotaPeriodEnd: month.periodEndIso
    },
    entitlement: {
      plan: 'base',
      monthlyQuota: 3,
      publishedThisMonth: 0,
      periodStart: month.periodStartIso,
      periodEnd: month.periodEndIso,
      status: 'active',
      billingMode: 'incubating',
      billingStatus: 'n/a'
    }
  };
}

async function fetchSiteSettingsUncached(): Promise<PublicSiteSettings> {
  const fallback = defaultSettings();
  if (!hasSanityConfig || !sanityClient) return fallback;
  const isProd = process.env.NODE_ENV === 'production';

  try {
    const data = await sanityClient.fetch<Partial<PublicSiteSettings>>(
      groq`*[_type == "siteSettings" && siteSlug == $siteSlug][0]{
        siteSlug,
        adSlotsEnabled,
        adsMode,
        adsPreviewEnabled,
        adsensePublisherId,
        adsenseSlotHeader,
        adsenseSlotInContent,
        adsenseSlotFooter,
        fallbackToPlatform,
        studioUrl,
        publishing,
        entitlement
      }`,
      { siteSlug: siteConfig.slug },
      isProd ? { next: { revalidate: 300 } } : { cache: 'no-store' }
    );

    if (!data) return fallback;

    return {
      ...fallback,
      ...data,
      siteSlug: String(data.siteSlug || fallback.siteSlug),
      adSlotsEnabled: Boolean(data.adSlotsEnabled ?? fallback.adSlotsEnabled),
      adsMode:
        data.adsMode === 'manual' || data.adsMode === 'hybrid' || data.adsMode === 'auto'
          ? data.adsMode
          : fallback.adsMode,
      adsPreviewEnabled: Boolean(data.adsPreviewEnabled ?? fallback.adsPreviewEnabled),
      adsensePublisherId: String(data.adsensePublisherId || ''),
      adsenseSlotHeader: String(data.adsenseSlotHeader || ''),
      adsenseSlotInContent: String(data.adsenseSlotInContent || ''),
      adsenseSlotFooter: String(data.adsenseSlotFooter || ''),
      fallbackToPlatform: Boolean(data.fallbackToPlatform ?? fallback.fallbackToPlatform),
      studioUrl: String(data.studioUrl || fallback.studioUrl),
      publishing: {
        ...fallback.publishing,
        ...(data.publishing || {}),
        mode: data.publishing?.mode === 'bulk_direct' ? 'bulk_direct' : 'steady_scheduled',
        maxPublishesPerRun: Number(data.publishing?.maxPublishesPerRun || fallback.publishing.maxPublishesPerRun),
        planMonthlyQuota: Number(data.publishing?.planMonthlyQuota || fallback.publishing.planMonthlyQuota),
        publishedThisMonth: Number(data.publishing?.publishedThisMonth || fallback.publishing.publishedThisMonth),
        quotaPeriodStart: String(data.publishing?.quotaPeriodStart || fallback.publishing.quotaPeriodStart),
        quotaPeriodEnd: String(data.publishing?.quotaPeriodEnd || fallback.publishing.quotaPeriodEnd)
      },
      entitlement: {
        ...fallback.entitlement,
        ...(data.entitlement || {}),
        plan:
          data.entitlement?.plan === 'standard' || data.entitlement?.plan === 'pro' || data.entitlement?.plan === 'base'
            ? data.entitlement.plan
            : fallback.entitlement.plan,
        monthlyQuota: Number(data.entitlement?.monthlyQuota || fallback.entitlement.monthlyQuota),
        publishedThisMonth: Number(data.entitlement?.publishedThisMonth || fallback.entitlement.publishedThisMonth),
        periodStart: String(data.entitlement?.periodStart || fallback.entitlement.periodStart),
        periodEnd: String(data.entitlement?.periodEnd || fallback.entitlement.periodEnd),
        status:
          data.entitlement?.status === 'paused' || data.entitlement?.status === 'stopped' || data.entitlement?.status === 'active'
            ? data.entitlement.status
            : fallback.entitlement.status,
        billingMode:
          data.entitlement?.billingMode === 'customer_paid' ||
          data.entitlement?.billingMode === 'incubating' ||
          data.entitlement?.billingMode === 'complimentary'
            ? data.entitlement.billingMode
            : fallback.entitlement.billingMode,
        billingStatus:
          data.entitlement?.billingStatus === 'n/a' ||
          data.entitlement?.billingStatus === 'trial' ||
          data.entitlement?.billingStatus === 'active' ||
          data.entitlement?.billingStatus === 'overdue' ||
          data.entitlement?.billingStatus === 'canceled'
            ? data.entitlement.billingStatus
            : fallback.entitlement.billingStatus
      }
    };
  } catch {
    return fallback;
  }
}

const fetchSiteSettingsCached = cache(fetchSiteSettingsUncached);

export async function getPublicSiteSettings() {
  if (process.env.NODE_ENV !== 'production') {
    return fetchSiteSettingsUncached();
  }
  return fetchSiteSettingsCached();
}

export function resolveAdPublisherId(settings: PublicSiteSettings) {
  if (settings.adsensePublisherId) return settings.adsensePublisherId;
  if (settings.fallbackToPlatform) {
    return String(process.env.PLATFORM_ADSENSE_PUBLISHER_ID || '').trim();
  }
  return '';
}

export function resolvePortalBaseUrl() {
  return String(process.env.NEXT_PUBLIC_PORTAL_BASE_URL || process.env.PORTAL_BASE_URL || '').replace(/\/$/, '');
}
