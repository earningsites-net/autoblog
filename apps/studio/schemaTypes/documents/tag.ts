import { defineField, defineType } from 'sanity';

export const tagType = defineType({
  name: 'tag',
  title: 'Tag',
  type: 'document',
  fields: [
    defineField({ name: 'siteSlug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: (Rule) => Rule.required() })
  ],
  preview: {
    select: { title: 'title', siteSlug: 'siteSlug' },
    prepare: ({ title, siteSlug }) => ({ title, subtitle: siteSlug || 'no-site' })
  }
});
