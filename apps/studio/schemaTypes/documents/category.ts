import { defineField, defineType } from 'sanity';

export const categoryType = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({ name: 'siteSlug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'title', type: 'string', validation: (Rule) => Rule.required().max(80) }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({ name: 'description', type: 'text', rows: 3, validation: (Rule) => Rule.required().max(240) }),
    defineField({ name: 'accent', type: 'string', options: { list: ['rust', 'sage'] }, initialValue: 'rust' }),
    defineField({ name: 'allowedScopeNotes', type: 'text', rows: 4 }),
    defineField({ name: 'excludedScopeNotes', type: 'text', rows: 4 })
  ],
  preview: {
    select: { title: 'title', subtitle: 'description', siteSlug: 'siteSlug' },
    prepare: ({ title, subtitle, siteSlug }) => ({
      title,
      subtitle: `${siteSlug || 'no-site'} • ${subtitle || ''}`
    })
  }
});
