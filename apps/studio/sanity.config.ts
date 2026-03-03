import { defineConfig } from 'sanity';
import { deskTool } from 'sanity/desk';
import { visionTool } from '@sanity/vision';
import { deskStructure } from './desk-structure';
import { schemaTypes } from './schemaTypes';

const projectId =
  import.meta.env.SANITY_STUDIO_PROJECT_ID ||
  import.meta.env.VITE_SANITY_PROJECT_ID ||
  'replace-project-id';

const dataset =
  import.meta.env.SANITY_STUDIO_DATASET ||
  import.meta.env.VITE_SANITY_DATASET ||
  'production';

const studioSiteSlug =
  import.meta.env.SANITY_STUDIO_SITE_SLUG ||
  import.meta.env.VITE_SANITY_STUDIO_SITE_SLUG ||
  import.meta.env.SITE_SLUG ||
  '';

const titleScope = studioSiteSlug ? `/${studioSiteSlug}` : '';
const studioTitle = `Auto Blog Studio (${projectId}/${dataset}${titleScope})`;

export default defineConfig({
  name: 'default',
  title: studioTitle,
  projectId,
  dataset,
  plugins: [deskTool({ structure: deskStructure(studioSiteSlug) }), visionTool()],
  schema: {
    types: schemaTypes
  }
});
