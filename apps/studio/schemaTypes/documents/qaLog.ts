import { defineArrayMember, defineField, defineType } from 'sanity';

export const qaLogType = defineType({
  name: 'qaLog',
  title: 'QA Log',
  type: 'document',
  fields: [
    defineField({ name: 'siteSlug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'article', type: 'reference', to: [{ type: 'article' }] }),
    defineField({ name: 'topicCandidate', type: 'reference', to: [{ type: 'topicCandidate' }] }),
    defineField({ name: 'workflowRunId', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'score', type: 'number', validation: (Rule) => Rule.required().min(0).max(100) }),
    defineField({ name: 'decision', type: 'string', options: { list: ['publish', 'reject', 'retry'] }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'flags', type: 'array', of: [defineArrayMember({ type: 'string' })], initialValue: [] }),
    defineField({ name: 'checks', type: 'object', fields: [
      defineField({ name: 'wordCount', type: 'number' }),
      defineField({ name: 'seoComplete', type: 'boolean' }),
      defineField({ name: 'duplicateScore', type: 'number' }),
      defineField({ name: 'readability', type: 'number' })
    ]}),
    defineField({ name: 'createdAt', type: 'datetime', initialValue: () => new Date().toISOString() })
  ],
  preview: {
    select: { title: 'workflowRunId', subtitle: 'decision', score: 'score', siteSlug: 'siteSlug' },
    prepare: ({ title, subtitle, score, siteSlug }) => ({
      title,
      subtitle: `${siteSlug || 'no-site'} • ${subtitle ?? 'decision'} • ${score ?? 0}`
    })
  }
});
