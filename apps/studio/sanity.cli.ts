import './load-local-env';
import { defineCliConfig } from 'sanity/cli';

const projectId =
  process.env.SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  'replace-project-id';

const dataset =
  process.env.SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  'production';

export default defineCliConfig({
  api: {
    projectId,
    dataset
  }
});
