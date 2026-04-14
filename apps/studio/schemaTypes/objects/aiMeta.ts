import { defineField, defineType } from 'sanity';

export const aiMetaType = defineType({
  name: 'aiMeta',
  title: 'AI Metadata',
  type: 'object',
  fields: [
    defineField({ name: 'textModelDraft', type: 'string' }),
    defineField({ name: 'textModelQa', type: 'string' }),
    defineField({ name: 'imageModel', type: 'string' }),
    defineField({ name: 'costEstimateUsd', type: 'number', initialValue: 0 }),
    defineField({ name: 'workflowRunId', type: 'string' }),
    defineField({ name: 'schedulerRunId', type: 'string' }),
    defineField({ name: 'schedulerRunIndex', type: 'number' }),
    defineField({ name: 'qualityTier', type: 'string', options: { list: ['normal', 'economy', 'throttle'] } }),
    defineField({ name: 'budgetMode', type: 'string', options: { list: ['normal', 'economy', 'throttle', 'stop'] } }),
    defineField({ name: 'imagePromptVersion', type: 'string' }),
    defineField({ name: 'textPromptVersion', type: 'string' })
  ]
});
