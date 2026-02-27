import { defineArrayMember, defineField, defineType } from 'sanity';

export const faqItemType = defineType({
  name: 'faqItem',
  title: 'FAQ Item',
  type: 'object',
  fields: [
    defineField({ name: 'question', type: 'string', validation: (Rule) => Rule.required().min(8).max(200) }),
    defineField({ name: 'answer', type: 'text', rows: 4, validation: (Rule) => Rule.required().min(20) }),
    defineField({
      name: 'structuredDataHints',
      title: 'Structured Data Hints',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      initialValue: []
    })
  ],
  preview: {
    select: { title: 'question', subtitle: 'answer' },
    prepare: ({ title, subtitle }) => ({ title, subtitle: subtitle?.slice(0, 90) })
  }
});
