import { defineArrayMember, defineField, defineType } from 'sanity';

export const articleType = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'seo', title: 'SEO' },
    { name: 'automation', title: 'Automation' }
  ],
  fields: [
    defineField({ name: 'siteSlug', type: 'string', group: 'automation', validation: (Rule) => Rule.required() }),
    defineField({ name: 'title', type: 'string', group: 'content', validation: (Rule) => Rule.required().max(120) }),
    defineField({
      name: 'slug',
      type: 'slug',
      group: 'content',
      options: { source: 'title', maxLength: 120, isUnique: async (slug, context) => context.defaultIsUnique(slug, context) },
      validation: (Rule) => Rule.required()
    }),
    defineField({ name: 'excerpt', type: 'text', rows: 3, group: 'content', validation: (Rule) => Rule.required().max(320) }),
    defineField({
      name: 'coverImage',
      type: 'image',
      group: 'content',
      options: { hotspot: true },
      fields: [
        defineField({ name: 'aiPrompt', type: 'text', rows: 2 }),
        defineField({ name: 'modelVersion', type: 'string' })
      ]
    }),
    defineField({ name: 'coverImageAlt', type: 'string', group: 'content', validation: (Rule) => Rule.required().max(180) }),
    defineField({
      name: 'category',
      type: 'reference',
      to: [{ type: 'category' }],
      group: 'content',
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'tag' }]
        })
      ],
      group: 'content'
    }),
    defineField({
      name: 'body',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'H2', value: 'h2' },
            { title: 'H3', value: 'h3' }
          ],
          lists: [],
          marks: { decorators: [], annotations: [] }
        })
      ]
    }),
    defineField({ name: 'faqItems', type: 'array', of: [defineArrayMember({ type: 'faqItem' })], group: 'content', initialValue: [] }),
    defineField({ name: 'internalLinks', type: 'array', of: [defineArrayMember({ type: 'internalLink' })], group: 'content', initialValue: [] }),
    defineField({ name: 'disclaimerVariant', type: 'string', group: 'content', options: { list: ['general', 'safety'] }, initialValue: 'general' }),

    defineField({ name: 'seoTitle', type: 'string', group: 'seo', validation: (Rule) => Rule.max(70) }),
    defineField({ name: 'seoDescription', type: 'text', rows: 2, group: 'seo', validation: (Rule) => Rule.max(170) }),
    defineField({ name: 'canonicalUrl', type: 'url', group: 'seo' }),

    defineField({
      name: 'status',
      type: 'string',
      group: 'automation',
      options: { list: ['draft', 'ready_to_publish', 'published', 'rejected_auto'] },
      initialValue: 'draft'
    }),
    defineField({ name: 'qaPassedAt', type: 'datetime', group: 'automation' }),
    defineField({ name: 'publishScheduledAt', type: 'datetime', group: 'automation' }),
    defineField({ name: 'publishedAt', type: 'datetime', group: 'automation' }),
    defineField({ name: 'qaScore', type: 'number', group: 'automation', initialValue: 0 }),
    defineField({ name: 'qaFlags', type: 'array', of: [defineArrayMember({ type: 'string' })], group: 'automation', initialValue: [] }),
    defineField({ name: 'readTimeMinutes', type: 'number', group: 'automation', initialValue: 0 }),
    defineField({
      name: 'pipelineMode',
      type: 'string',
      group: 'automation',
      options: { list: ['prepopulate_bulk_direct', 'steady_scheduled'] },
      initialValue: 'prepopulate_bulk_direct'
    }),
    defineField({ name: 'prepopulateBatchId', type: 'string', group: 'automation' }),
    defineField({ name: 'publishSequence', type: 'number', group: 'automation' }),
    defineField({ name: 'aiMeta', type: 'aiMeta', group: 'automation' })
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'status',
      siteSlug: 'siteSlug',
      media: 'coverImage',
      score: 'qaScore'
    },
    prepare: ({ title, subtitle, media, score, siteSlug }) => ({
      title,
      subtitle: `${siteSlug || 'no-site'} • ${subtitle ?? 'draft'} • QA ${score ?? 0}`,
      media
    })
  },
  orderings: [
    {
      title: 'Published date, newest',
      name: 'publishedDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }]
    }
  ]
});
