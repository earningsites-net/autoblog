import imageUrlBuilder from '@sanity/image-url';
import { createClient } from 'next-sanity';

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || 'production';
const apiVersion = process.env.SANITY_API_VERSION || '2025-01-01';

export const hasSanityConfig = Boolean(projectId && dataset);

export const sanityClient = hasSanityConfig
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      token: process.env.SANITY_READ_TOKEN,
      useCdn: true,
      perspective: 'published'
    })
  : null;

const builder = projectId ? imageUrlBuilder({ projectId, dataset }) : null;

export function urlFor(source: unknown) {
  if (!builder) return null;
  return builder.image(source as Parameters<typeof builder.image>[0]);
}
