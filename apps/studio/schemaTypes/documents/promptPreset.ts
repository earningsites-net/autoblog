import { defineField, defineType } from 'sanity';

export const promptPresetType = defineType({
  name: 'promptPreset',
  title: 'Prompt Preset',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'stage', type: 'string', options: { list: ['topic', 'brief', 'article', 'image', 'qa'] }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'version', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'modelHint', type: 'string' }),
    defineField({ name: 'promptTemplate', type: 'text', rows: 18, validation: (Rule) => Rule.required() }),
    defineField({ name: 'active', type: 'boolean', initialValue: true })
  ],
  preview: {
    select: { title: 'name', subtitle: 'version', stage: 'stage' },
    prepare: ({ title, subtitle, stage }) => ({ title, subtitle: `${stage ?? 'stage'} • ${subtitle ?? 'v?'}` })
  }
});
