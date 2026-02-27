import { defineArrayMember, defineField, defineType } from 'sanity';

export const topicCandidateType = defineType({
  name: 'topicCandidate',
  title: 'Topic Candidate',
  type: 'document',
  fields: [
    defineField({ name: 'query', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'targetKeyword', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'supportingKeywords',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      initialValue: []
    }),
    defineField({ name: 'categorySlug', type: 'string' }),
    defineField({ name: 'searchIntent', type: 'string', initialValue: 'informational', options: { list: ['informational'] } }),
    defineField({ name: 'templateType', type: 'string', options: { list: ['how-to', 'list', 'tips', 'checklist'] }, initialValue: 'tips' }),
    defineField({
      name: 'status',
      type: 'string',
      options: { list: ['queued', 'brief_ready', 'generated', 'skipped'] },
      initialValue: 'queued'
    }),
    defineField({ name: 'evergreenScore', type: 'number', initialValue: 0, validation: (Rule) => Rule.min(0).max(100) }),
    defineField({ name: 'riskScore', type: 'number', initialValue: 0, validation: (Rule) => Rule.min(0).max(100) }),
    defineField({ name: 'whyNow', type: 'text', rows: 2 }),
    defineField({ name: 'brief', type: 'object', fields: [
      defineField({ name: 'angle', type: 'string' }),
      defineField({ name: 'audience', type: 'string' }),
      defineField({ name: 'outlineMarkdown', type: 'text', rows: 8 }),
      defineField({ name: 'faqIdeas', type: 'array', of: [defineArrayMember({ type: 'string' })] })
    ]}),
    defineField({ name: 'workflowRunId', type: 'string' })
  ],
  preview: {
    select: { title: 'query', subtitle: 'status', score: 'evergreenScore' },
    prepare: ({ title, subtitle, score }) => ({ title, subtitle: `${subtitle ?? 'queued'} • evergreen ${score ?? 0}` })
  }
});
