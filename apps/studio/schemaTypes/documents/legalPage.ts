import { defineField, defineType } from 'sanity';

export const legalPageType = defineType({
  name: 'legalPage',
  title: 'Legal Page',
  type: 'document',
  fields: [
    defineField({ name: 'siteSlug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'title', type: 'string', validation: (Rule) => Rule.required().max(120) }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: 'kind',
      type: 'string',
      options: { list: ['about', 'contact', 'privacy-policy', 'cookie-policy', 'disclaimer'] },
      validation: (Rule) => Rule.required()
    }),
    defineField({ name: 'content', type: 'text', rows: 16, validation: (Rule) => Rule.required() })
  ],
  preview: {
    select: { title: 'title', subtitle: 'kind', siteSlug: 'siteSlug' },
    prepare: ({ title, subtitle, siteSlug }) => ({
      title,
      subtitle: `${siteSlug || 'no-site'} • ${subtitle || ''}`
    })
  }
});
