import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PortalSiteEntitlement, PortalSiteSettings } from './portal-store-types';
import {
  normalizeSiteSlug,
  resolveRuntimePaths,
  resolveSiteBlueprintPath,
  resolveSiteHandoffPath,
  resolveSiteReadmePath,
  resolveSiteRuntimeDir,
  resolveSiteRuntimeEnvPath,
  resolveSiteSeedContentPath,
  type RuntimePaths
} from './runtime-paths';

type RegistrySiteEntry = {
  siteSlug: string;
  ownerType?: 'internal' | 'client';
  mode?: 'transfer' | 'managed';
  sanityProjectId?: string;
  sanityDataset?: string;
  sanityApiVersion?: string;
  tokenRefs?: {
    read?: string;
    write?: string;
  };
  webBaseUrl?: string;
  domainStatus?: 'pending' | 'active' | 'transferred';
  automationStatus?: 'inactive' | 'active' | 'paused';
  billingStatus?: 'n/a' | 'trial' | 'active' | 'overdue' | 'canceled';
  ownerEmail?: string;
  studioUrl?: string;
  adConfig?: {
    provider: 'adsense';
    mode?: 'auto' | 'manual' | 'hybrid';
    fallbackToPlatform?: boolean;
    publisherId?: string;
    slots?: {
      header?: string;
      inContent?: string;
      footer?: string;
    };
  };
  updatedAt?: string;
};

type RegistryDocument = {
  version: number;
  updatedAt: string;
  sites: RegistrySiteEntry[];
};

function nowIso() {
  return new Date().toISOString();
}

function parseEnv(content: string) {
  const out: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function serializeEnv(envMap: Record<string, string>) {
  return `${Object.entries(envMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .join('\n')}\n`;
}

function sanitizeSlugForDocId(siteSlug: string) {
  return normalizeSiteSlug(siteSlug) || 'default';
}

export class SiteRuntimeService {
  private readonly runtimePaths: RuntimePaths;

  constructor(private readonly workspaceRoot: string) {
    this.runtimePaths = resolveRuntimePaths(workspaceRoot);
  }

  getRuntimePaths() {
    return this.runtimePaths;
  }

  getRegistryPath() {
    return this.runtimePaths.registryPath;
  }

  getSiteBlueprintPath(siteSlug: string) {
    return resolveSiteBlueprintPath(this.workspaceRoot, siteSlug);
  }

  getSiteReadmePath(siteSlug: string) {
    return resolveSiteReadmePath(this.workspaceRoot, siteSlug);
  }

  getSiteRuntimeDir(siteSlug: string) {
    return resolveSiteRuntimeDir(this.runtimePaths, siteSlug);
  }

  getSiteEnvPath(siteSlug: string) {
    return resolveSiteRuntimeEnvPath(this.runtimePaths, siteSlug);
  }

  getSiteSeedContentPath(siteSlug: string, fileName: string) {
    return resolveSiteSeedContentPath(this.runtimePaths, siteSlug, fileName);
  }

  getSiteHandoffPath(siteSlug: string, fileName: string) {
    return resolveSiteHandoffPath(this.runtimePaths, siteSlug, fileName);
  }

  async readSiteEnv(siteSlug: string) {
    const filePath = this.getSiteEnvPath(siteSlug);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return parseEnv(raw);
    } catch {
      return {} as Record<string, string>;
    }
  }

  async patchSiteEnv(siteSlug: string, updates: Record<string, string | undefined>) {
    const filePath = this.getSiteEnvPath(siteSlug);
    const env = await this.readSiteEnv(siteSlug);

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'undefined') continue;
      env[key] = String(value);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, serializeEnv(env), 'utf8');
    return filePath;
  }

  async loadRegistry(): Promise<RegistryDocument> {
    try {
      const raw = await fs.readFile(this.getRegistryPath(), 'utf8');
      const parsed = JSON.parse(raw) as RegistryDocument;
      if (!Array.isArray(parsed.sites)) throw new Error('Invalid registry shape');
      return parsed;
    } catch {
      return {
        version: 1,
        updatedAt: nowIso(),
        sites: []
      };
    }
  }

  async saveRegistry(registry: RegistryDocument) {
    const registryPath = this.getRegistryPath();
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  }

  async upsertRegistrySite(siteSlug: string, patch: Partial<RegistrySiteEntry>) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const registry = await this.loadRegistry();
    const currentIndex = registry.sites.findIndex((site) => normalizeSiteSlug(site.siteSlug) === normalizedSlug);
    const current = currentIndex >= 0 ? registry.sites[currentIndex] : null;

    const merged: RegistrySiteEntry = {
      siteSlug: normalizedSlug,
      ownerType: patch.ownerType || current?.ownerType || 'internal',
      mode: patch.mode || current?.mode || 'transfer',
      sanityProjectId: patch.sanityProjectId || current?.sanityProjectId || '',
      sanityDataset: patch.sanityDataset || current?.sanityDataset || 'production',
      sanityApiVersion: patch.sanityApiVersion || current?.sanityApiVersion || '2025-01-01',
      tokenRefs: {
        read: patch.tokenRefs?.read || current?.tokenRefs?.read || 'SITE_SANITY_READ_TOKEN',
        write: patch.tokenRefs?.write || current?.tokenRefs?.write || 'SITE_SANITY_WRITE_TOKEN'
      },
      webBaseUrl: patch.webBaseUrl || current?.webBaseUrl || '',
      domainStatus: patch.domainStatus || current?.domainStatus || 'pending',
      automationStatus: patch.automationStatus || current?.automationStatus || 'inactive',
      billingStatus: patch.billingStatus || current?.billingStatus || 'trial',
      ownerEmail: patch.ownerEmail || current?.ownerEmail || '',
      studioUrl: patch.studioUrl || current?.studioUrl || '',
      adConfig: {
        provider: 'adsense',
        mode: patch.adConfig?.mode ?? current?.adConfig?.mode ?? 'auto',
        fallbackToPlatform: patch.adConfig?.fallbackToPlatform ?? current?.adConfig?.fallbackToPlatform ?? true,
        publisherId: patch.adConfig?.publisherId ?? current?.adConfig?.publisherId ?? '',
        slots: {
          header: patch.adConfig?.slots?.header ?? current?.adConfig?.slots?.header ?? '',
          inContent: patch.adConfig?.slots?.inContent ?? current?.adConfig?.slots?.inContent ?? '',
          footer: patch.adConfig?.slots?.footer ?? current?.adConfig?.slots?.footer ?? ''
        }
      },
      updatedAt: nowIso()
    };

    if (currentIndex >= 0) {
      registry.sites[currentIndex] = merged;
    } else {
      registry.sites.push(merged);
    }

    registry.updatedAt = nowIso();
    await this.saveRegistry(registry);
    return merged;
  }

  async getRegistrySite(siteSlug: string): Promise<RegistrySiteEntry | null> {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const registry = await this.loadRegistry();
    return registry.sites.find((site) => normalizeSiteSlug(site.siteSlug) === normalizedSlug) || null;
  }

  async getSiteSanityConnection(siteSlug: string) {
    const env = await this.readSiteEnv(siteSlug);
    // Strict per-site mode: no fallback to root/global SANITY_* env vars.
    return {
      projectId: String(env.SANITY_PROJECT_ID || '').trim(),
      dataset: String(env.SANITY_DATASET || 'production').trim(),
      apiVersion: String(env.SANITY_API_VERSION || '2025-01-01').trim(),
      readToken: String(env.SANITY_READ_TOKEN || env.SITE_SANITY_READ_TOKEN || '').trim(),
      writeToken: String(env.SANITY_WRITE_TOKEN || env.SITE_SANITY_WRITE_TOKEN || '').trim()
    };
  }

  async syncSiteSettingsToSanity(
    siteSlug: string,
    settings: PortalSiteSettings,
    entitlement: PortalSiteEntitlement
  ) {
    const normalizedSlug = normalizeSiteSlug(siteSlug);
    const conn = await this.getSiteSanityConnection(normalizedSlug);
    if (!conn.projectId || !conn.writeToken) {
      return {
        ok: false,
        skipped: true,
        reason: 'Missing site SANITY_PROJECT_ID or SANITY_WRITE_TOKEN in the site runtime env (.env.generated)'
      };
    }

    const siteSettingsId = `siteSettings-${sanitizeSlugForDocId(normalizedSlug)}-root`;
    const mutations = {
      mutations: [
        {
          createIfNotExists: {
            _id: siteSettingsId,
            _type: 'siteSettings',
            siteSlug: normalizedSlug
          }
        },
        {
          patch: {
            id: siteSettingsId,
            set: {
              siteSlug: normalizedSlug,
              adSlotsEnabled: settings.adSlotsEnabled,
              adsMode: settings.adsMode,
              adsPreviewEnabled: settings.adsPreviewEnabled,
              adsensePublisherId: settings.adsensePublisherId,
              adsenseSlotHeader: settings.adsenseSlotHeader,
              adsenseSlotInContent: settings.adsenseSlotInContent,
              adsenseSlotFooter: settings.adsenseSlotFooter,
              fallbackToPlatform: settings.fallbackToPlatform,
              ...(settings.studioUrl ? { studioUrl: settings.studioUrl } : {}),
              'publishing.mode': settings.publishingEnabled ? 'steady_scheduled' : 'bulk_direct',
              'publishing.maxPublishesPerRun': settings.maxPublishesPerRun,
              'publishing.planMonthlyQuota': entitlement.monthlyQuota,
              'publishing.publishedThisMonth': entitlement.publishedThisMonth,
              'publishing.quotaPeriodStart': entitlement.periodStart,
              'publishing.quotaPeriodEnd': entitlement.periodEnd,
              'entitlement.plan': entitlement.plan,
              'entitlement.monthlyQuota': entitlement.monthlyQuota,
              'entitlement.publishedThisMonth': entitlement.publishedThisMonth,
              'entitlement.periodStart': entitlement.periodStart,
              'entitlement.periodEnd': entitlement.periodEnd,
              'entitlement.status': entitlement.status,
              'entitlement.billingStatus': entitlement.billingStatus
            }
          }
        }
      ]
    };

    const response = await fetch(
      `https://${conn.projectId}.api.sanity.io/v${conn.apiVersion}/data/mutate/${conn.dataset}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${conn.writeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mutations)
      }
    );

    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        skipped: false,
        reason: `Sanity sync failed (${response.status}): ${text}`
      };
    }

    return {
      ok: true,
      skipped: false
    };
  }
}
