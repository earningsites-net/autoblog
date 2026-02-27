import { defineConfig } from 'sanity';
import { deskTool } from 'sanity/desk';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemaTypes';

const projectId =
  import.meta.env.SANITY_STUDIO_PROJECT_ID ||
  import.meta.env.VITE_SANITY_PROJECT_ID ||
  'replace-project-id';

const dataset =
  import.meta.env.SANITY_STUDIO_DATASET ||
  import.meta.env.VITE_SANITY_DATASET ||
  'production';

export default defineConfig({
  name: 'default',
  title: 'Auto Blog Studio',
  projectId,
  dataset,
  plugins: [deskTool(), visionTool()],
  schema: {
    types: schemaTypes
  }
});
