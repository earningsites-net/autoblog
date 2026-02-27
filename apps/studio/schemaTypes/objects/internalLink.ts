import { defineField, defineType } from 'sanity';

export const internalLinkType = defineType({
  name: 'internalLink',
  title: 'Internal Link',
  type: 'object',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'reason', type: 'string' })
  ]
});
