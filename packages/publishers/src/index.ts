import type { Publisher, SiteBlueprint } from '@autoblog/factory-sdk';
import { SanityPublisher } from './sanity-publisher';
import { WordPressPublisher } from './wordpress-publisher';
import { DirectusPublisher } from './directus-publisher';

export * from './sanity-publisher';
export * from './wordpress-publisher';
export * from './directus-publisher';

export function createPublisher(blueprint: SiteBlueprint): Publisher {
  switch (blueprint.publishingTarget.kind) {
    case 'sanity':
      return new SanityPublisher();
    case 'wordpress':
      return new WordPressPublisher();
    case 'directus':
      return new DirectusPublisher();
    default:
      throw new Error(`Unsupported publishing target: ${(blueprint as SiteBlueprint).publishingTarget}`);
  }
}
