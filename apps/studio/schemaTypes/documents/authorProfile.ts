import { defineField, defineType } from 'sanity';

export const authorProfileType = defineType({
  name: 'authorProfile',
  title: 'Author Profile',
  type: 'document',
  fields: [
    defineField({ name: 'siteSlug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'name', type: 'string', validation: (Rule) => Rule.required().max(80) }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'name', maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({ name: 'role', type: 'string', validation: (Rule) => Rule.required().max(80) }),
    defineField({ name: 'bio', type: 'text', rows: 4, validation: (Rule) => Rule.required().max(320) })
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'role',
      siteSlug: 'siteSlug'
    },
    prepare: ({ title, subtitle, siteSlug }) => ({
      title,
      subtitle: `${siteSlug || 'no-site'}${subtitle ? ` • ${subtitle}` : ''}`
    })
  }
});
