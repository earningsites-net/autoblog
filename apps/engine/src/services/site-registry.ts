import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getBlueprintTemplate, listBlueprintTemplateIds } from '@autoblog/blueprints';
import { siteBlueprintSchema } from '@autoblog/factory-sdk';
import type { SiteBlueprint, SiteRegistry } from '@autoblog/factory-sdk';
import { resolveAllSitesSourceRoots } from './runtime-paths';

export class LocalSiteRegistry implements SiteRegistry {
  constructor(private readonly workspaceRoot: string) {}

  private getSitesRoots() {
    return resolveAllSitesSourceRoots(this.workspaceRoot);
  }

  async listSites(): Promise<SiteBlueprint[]> {
    const discovered = await this.loadSitesFromDisk();
    if (discovered.length) return discovered;
    return listBlueprintTemplateIds().map((id) => getBlueprintTemplate(id));
  }

  async getSite(siteSlug: string): Promise<SiteBlueprint | null> {
    const sites = await this.listSites();
    return sites.find((site) => site.siteSlug === siteSlug) ?? null;
  }

  private async loadSitesFromDisk(): Promise<SiteBlueprint[]> {
    const blueprints = new Map<string, SiteBlueprint>();

    for (const sitesRoot of this.getSitesRoots()) {
      try {
        const entries = await fs.readdir(sitesRoot, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const blueprintPath = path.join(sitesRoot, entry.name, 'site.blueprint.json');
          try {
            const raw = await fs.readFile(blueprintPath, 'utf8');
            const parsed = siteBlueprintSchema.parse(JSON.parse(raw));
            blueprints.set(parsed.siteSlug, parsed);
          } catch {
            // ignore invalid/uninitialized site folders
          }
        }
      } catch {
        // ignore missing roots
      }
    }

    return Array.from(blueprints.values());
  }
}
