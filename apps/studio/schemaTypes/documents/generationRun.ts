import { defineArrayMember, defineField, defineType } from 'sanity';

export const generationRunType = defineType({
  name: 'generationRun',
  title: 'Generation Run',
  type: 'document',
  fields: [
    defineField({ name: 'siteSlug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'workflowRunId', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'workflowName', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'status', type: 'string', options: { list: ['success', 'partial', 'failed'] }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'budgetMode', type: 'string', options: { list: ['normal', 'economy', 'throttle', 'stop'] }, initialValue: 'normal' }),
    defineField({ name: 'costEstimateUsd', type: 'number', initialValue: 0 }),
    defineField({ name: 'startedAt', type: 'datetime' }),
    defineField({ name: 'finishedAt', type: 'datetime' }),
    defineField({
      name: 'metrics',
      type: 'object',
      fields: [
        defineField({ name: 'topicsProcessed', type: 'number', initialValue: 0 }),
        defineField({ name: 'articlesGenerated', type: 'number', initialValue: 0 }),
        defineField({ name: 'articlesPublished', type: 'number', initialValue: 0 }),
        defineField({ name: 'articlesRejected', type: 'number', initialValue: 0 }),
        defineField({ name: 'imageFailures', type: 'number', initialValue: 0 })
      ]
    }),
    defineField({ name: 'errors', type: 'array', of: [defineArrayMember({ type: 'string' })], initialValue: [] }),
    defineField({ name: 'rawPayload', type: 'text', rows: 12 })
  ],
  preview: {
    select: { title: 'workflowName', subtitle: 'status', run: 'workflowRunId', siteSlug: 'siteSlug' },
    prepare: ({ title, subtitle, run, siteSlug }) => ({
      title,
      subtitle: `${siteSlug || 'no-site'} • ${subtitle ?? 'status'} • ${run ?? ''}`
    })
  }
});
