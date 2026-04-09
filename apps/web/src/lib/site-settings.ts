import { cache } from 'react';
import groq from 'groq';
import { hasSanityConfig, sanityClient } from './sanity';
import { siteConfig } from './site';

export type MonetizationPlacementTarget =
  | 'homeLead'
  | 'homeMid'
  | 'categoryTop'
  | 'articleTop'
  | 'articleSidebar'
  | 'articleBottom';

export type SiteMonetizationSettings = {
  enabled: boolean;
  providerName: string;
  headHtml: string;
  placements: Array<{
    target: MonetizationPlacementTarget;
    html: string;
  }>;
};

export type PublicSiteSettings = {
  siteSlug: string;
  monetization: SiteMonetizationSettings;
  studioUrl: string;
  publicContactEmail: string;
  privacyPolicyOverride: string;
  cookiePolicyOverride: string;
  disclaimerOverride: string;
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

export type PublicSiteRuntimeState = {
  siteSlug: string;
  brandName: string;
  inactiveForOwner: boolean;
  operationalStatus: 'active' | 'stopped';
  publicStatus: 'online' | 'offline';
  entitlement: {
    plan: 'base' | 'standard' | 'pro';
    status: 'active' | 'stopped';
    billingMode: 'customer_paid' | 'incubating' | 'complimentary';
    billingStatus: 'n/a' | 'trial' | 'active' | 'overdue' | 'canceled';
  };
  source: 'engine' | 'fallback';
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
    monetization: {
      enabled: false,
      providerName: '',
      headHtml: '',
      placements: []
    },
    studioUrl: process.env.SANITY_STUDIO_URL || '',
    publicContactEmail: '',
    privacyPolicyOverride: '',
    cookiePolicyOverride: '',
    disclaimerOverride: '',
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

function normalizeMonetization(settings: Partial<SiteMonetizationSettings> | null | undefined): SiteMonetizationSettings {
  const placements = Array.isArray(settings?.placements)
    ? settings.placements
        .map((placement) => {
          const target = String(placement?.target || '').trim();
          const html = String(placement?.html || '').trim();
          if (
            !html ||
            !(
              target === 'homeLead' ||
              target === 'homeMid' ||
              target === 'categoryTop' ||
              target === 'articleTop' ||
              target === 'articleSidebar' ||
              target === 'articleBottom'
            )
          ) {
            return null;
          }
          return {
            target: target as MonetizationPlacementTarget,
            html
          };
        })
        .filter((placement): placement is SiteMonetizationSettings['placements'][number] => Boolean(placement))
    : [];

  return {
    enabled: Boolean(settings?.enabled),
    providerName: String(settings?.providerName || '').trim(),
    headHtml: String(settings?.headHtml || '').trim(),
    placements
  };
}

type PublicPortalSiteSettingsOverlay = Pick<
  PublicSiteSettings,
  'publicContactEmail' | 'privacyPolicyOverride' | 'cookiePolicyOverride' | 'disclaimerOverride'
>;

async function fetchPublicSitePortalSettingsUncached(): Promise<PublicPortalSiteSettingsOverlay | null> {
  const baseUrl = resolveEnginePublicBaseUrl();
  if (!baseUrl || !siteConfig.slug) return null;

  try {
    const isProd = process.env.NODE_ENV === 'production';
    const response = await fetch(`${baseUrl}/api/public/sites/${encodeURIComponent(siteConfig.slug)}/settings`, isProd
      ? { next: { revalidate: 300 } }
      : { cache: 'no-store' });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      site?: {
        publicContactEmail?: string;
        privacyPolicyOverride?: string;
        cookiePolicyOverride?: string;
        disclaimerOverride?: string;
      };
    };
    const site = payload.site;
    if (!site) return null;

    return {
      publicContactEmail: String(site.publicContactEmail || ''),
      privacyPolicyOverride: String(site.privacyPolicyOverride || ''),
      cookiePolicyOverride: String(site.cookiePolicyOverride || ''),
      disclaimerOverride: String(site.disclaimerOverride || '')
    };
  } catch {
    return null;
  }
}

async function fetchSiteSettingsUncached(): Promise<PublicSiteSettings> {
  const fallback = defaultSettings();
  const isProd = process.env.NODE_ENV === 'production';
  let next = fallback;

  if (hasSanityConfig && sanityClient) {
    try {
      const data = await sanityClient.fetch<Partial<PublicSiteSettings>>(
        groq`*[_type == "siteSettings" && siteSlug == $siteSlug][0]{
          siteSlug,
          monetization,
          studioUrl,
          publicContactEmail,
          privacyPolicyOverride,
          cookiePolicyOverride,
          disclaimerOverride,
          publishing,
          entitlement
        }`,
        { siteSlug: siteConfig.slug },
        isProd ? { next: { revalidate: 300 } } : { cache: 'no-store' }
      );

      if (data) {
        next = {
          ...fallback,
          ...data,
          siteSlug: String(data.siteSlug || fallback.siteSlug),
          monetization: normalizeMonetization(data.monetization),
          studioUrl: String(data.studioUrl || fallback.studioUrl),
          publicContactEmail: String(data.publicContactEmail || ''),
          privacyPolicyOverride: String(data.privacyPolicyOverride || ''),
          cookiePolicyOverride: String(data.cookiePolicyOverride || ''),
          disclaimerOverride: String(data.disclaimerOverride || ''),
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
      }
    } catch {
      next = fallback;
    }
  }

  const portalOverlay = await fetchPublicSitePortalSettingsUncached();
  if (!portalOverlay) return next;

  return {
    ...next,
    publicContactEmail: portalOverlay.publicContactEmail ?? next.publicContactEmail,
    privacyPolicyOverride: portalOverlay.privacyPolicyOverride ?? next.privacyPolicyOverride,
    cookiePolicyOverride: portalOverlay.cookiePolicyOverride ?? next.cookiePolicyOverride,
    disclaimerOverride: portalOverlay.disclaimerOverride ?? next.disclaimerOverride
  };
}

const fetchSiteSettingsCached = cache(fetchSiteSettingsUncached);

export async function getPublicSiteSettings() {
  if (process.env.NODE_ENV !== 'production') {
    return fetchSiteSettingsUncached();
  }
  return fetchSiteSettingsCached();
}

export function hasConfiguredMonetization(settings: PublicSiteSettings) {
  if (!settings.monetization.enabled) return false;
  if (settings.monetization.headHtml) return true;
  return settings.monetization.placements.some((placement) => Boolean(placement.html));
}

export function getMonetizationPlacementHtml(settings: PublicSiteSettings, target: MonetizationPlacementTarget) {
  const placement = settings.monetization.placements.find((candidate) => candidate.target === target);
  return String(placement?.html || '').trim();
}

export function resolvePortalBaseUrl() {
  return String(process.env.NEXT_PUBLIC_PORTAL_BASE_URL || process.env.PORTAL_BASE_URL || '').replace(/\/$/, '');
}

function resolveEnginePublicBaseUrl() {
  return String(
    process.env.CONTENT_ENGINE_URL || process.env.NEXT_PUBLIC_PORTAL_BASE_URL || process.env.PORTAL_BASE_URL || ''
  ).replace(/\/$/, '');
}

function defaultRuntimeState(): PublicSiteRuntimeState {
  return {
    siteSlug: siteConfig.slug,
    brandName: siteConfig.name,
    inactiveForOwner: false,
    operationalStatus: 'active',
    publicStatus: 'online',
    entitlement: {
      plan: 'base',
      status: 'active',
      billingMode: 'incubating',
      billingStatus: 'n/a'
    },
    source: 'fallback'
  };
}

async function fetchPublicSiteRuntimeStateUncached(): Promise<PublicSiteRuntimeState> {
  const fallback = defaultRuntimeState();
  const baseUrl = resolveEnginePublicBaseUrl();
  if (!baseUrl || !siteConfig.slug) return fallback;

  try {
    const isProd = process.env.NODE_ENV === 'production';
    const response = await fetch(`${baseUrl}/api/public/sites/${encodeURIComponent(siteConfig.slug)}/state`, {
      ...(isProd ? { next: { revalidate: 60 } } : { cache: 'no-store' })
    });
    if (!response.ok) return fallback;
    const payload = (await response.json()) as {
      site?: {
        siteSlug?: string;
        brandName?: string;
        inactiveForOwner?: boolean;
        operationalStatus?: string;
        publicStatus?: string;
        entitlement?: {
          plan?: string;
          status?: string;
          billingMode?: string;
          billingStatus?: string;
        };
      };
    };

    const site = payload.site;
    if (!site) return fallback;

    return {
      siteSlug: String(site.siteSlug || fallback.siteSlug),
      brandName: String(site.brandName || fallback.brandName),
      inactiveForOwner: Boolean(site.inactiveForOwner),
      operationalStatus: site.operationalStatus === 'stopped' ? 'stopped' : 'active',
      publicStatus: site.publicStatus === 'offline' ? 'offline' : 'online',
      entitlement: {
        plan:
          site.entitlement?.plan === 'standard' || site.entitlement?.plan === 'pro' || site.entitlement?.plan === 'base'
            ? site.entitlement.plan
            : fallback.entitlement.plan,
        status: site.entitlement?.status === 'stopped' ? 'stopped' : 'active',
        billingMode:
          site.entitlement?.billingMode === 'customer_paid' ||
          site.entitlement?.billingMode === 'incubating' ||
          site.entitlement?.billingMode === 'complimentary'
            ? site.entitlement.billingMode
            : fallback.entitlement.billingMode,
        billingStatus:
          site.entitlement?.billingStatus === 'n/a' ||
          site.entitlement?.billingStatus === 'trial' ||
          site.entitlement?.billingStatus === 'active' ||
          site.entitlement?.billingStatus === 'overdue' ||
          site.entitlement?.billingStatus === 'canceled'
            ? site.entitlement.billingStatus
            : fallback.entitlement.billingStatus
      },
      source: 'engine'
    };
  } catch {
    return fallback;
  }
}

const fetchPublicSiteRuntimeStateCached = cache(fetchPublicSiteRuntimeStateUncached);

export async function getPublicSiteRuntimeState() {
  return fetchPublicSiteRuntimeStateCached();
}
