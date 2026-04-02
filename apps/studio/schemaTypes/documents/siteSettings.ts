import { defineArrayMember, defineField, defineType } from 'sanity';

export const siteSettingsType = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({ name: 'siteSlug', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'siteName', type: 'string', initialValue: 'Hammer & Hearth' }),
    defineField({ name: 'siteDescription', type: 'text', rows: 3 }),
    defineField({ name: 'defaultLocale', type: 'string', initialValue: 'en-US' }),
    defineField({ name: 'adSlotsEnabled', type: 'boolean', initialValue: false }),
    defineField({
      name: 'adsMode',
      type: 'string',
      initialValue: 'auto',
      options: { list: ['auto', 'manual', 'hybrid'] }
    }),
    defineField({ name: 'adsPreviewEnabled', type: 'boolean', initialValue: true }),
    defineField({ name: 'adsensePublisherId', type: 'string' }),
    defineField({ name: 'adsenseSlotHeader', type: 'string' }),
    defineField({ name: 'adsenseSlotInContent', type: 'string' }),
    defineField({ name: 'adsenseSlotFooter', type: 'string' }),
    defineField({ name: 'fallbackToPlatform', type: 'boolean', initialValue: true }),
    defineField({ name: 'studioUrl', type: 'url' }),
    defineField({ name: 'publicContactEmail', type: 'string' }),
    defineField({ name: 'privacyPolicyOverride', type: 'text', rows: 18 }),
    defineField({ name: 'cookiePolicyOverride', type: 'text', rows: 18 }),
    defineField({ name: 'disclaimerOverride', type: 'text', rows: 18 }),
    defineField({ name: 'gaMeasurementId', type: 'string' }),
    defineField({ name: 'searchConsoleVerification', type: 'string' }),
    defineField({ name: 'brandPrimaryColor', type: 'string', initialValue: '#E08748' }),
    defineField({ name: 'brandSecondaryColor', type: 'string', initialValue: '#829975' }),
    defineField({
      name: 'publishing',
      type: 'object',
      fields: [
        defineField({
          name: 'mode',
          type: 'string',
          initialValue: 'steady_scheduled',
          options: { list: ['bulk_direct', 'steady_scheduled'] }
        }),
        defineField({ name: 'defaultTimezone', type: 'string', initialValue: 'Europe/Rome' }),
        defineField({ name: 'revalidateEnabled', type: 'boolean', initialValue: true }),
        defineField({ name: 'revalidateContinueOnFail', type: 'boolean', initialValue: true }),
        defineField({ name: 'maxPublishesPerRun', type: 'number', initialValue: 1 }),
        defineField({ name: 'planMonthlyQuota', type: 'number', initialValue: 0 }),
        defineField({ name: 'publishedThisMonth', type: 'number', initialValue: 0 }),
        defineField({ name: 'quotaPeriodStart', type: 'datetime' }),
        defineField({ name: 'quotaPeriodEnd', type: 'datetime' }),
        defineField({
          name: 'cadenceRules',
          type: 'array',
          initialValue: [],
          of: [
            defineArrayMember({
              type: 'object',
              fields: [
                defineField({ name: 'label', type: 'string' }),
                defineField({ name: 'startAt', type: 'datetime' }),
                defineField({ name: 'endAt', type: 'datetime' }),
                defineField({ name: 'maxPublishes', type: 'number', validation: (Rule) => Rule.min(1) }),
                defineField({ name: 'perMinutes', type: 'number', validation: (Rule) => Rule.min(1) }),
                defineField({ name: 'perDays', type: 'number', validation: (Rule) => Rule.min(1) })
              ],
              preview: {
                select: {
                  title: 'label',
                  startAt: 'startAt',
                  endAt: 'endAt',
                  maxPublishes: 'maxPublishes',
                  perMinutes: 'perMinutes',
                  perDays: 'perDays'
                },
                prepare: ({ title, startAt, endAt, maxPublishes, perMinutes, perDays }) => ({
                  title: title || 'Cadence Rule',
                  subtitle: `${maxPublishes ?? '?'} per ${perMinutes ? `${perMinutes} min` : `${perDays ?? '?'} day`} • ${startAt ?? 'now'} -> ${endAt ?? 'open'}`
                })
              }
            })
          ]
        })
      ]
    }),
    defineField({
      name: 'entitlement',
      type: 'object',
      fields: [
        defineField({
          name: 'plan',
          type: 'string',
          options: { list: ['base', 'standard', 'pro'] },
          initialValue: 'base'
        }),
        defineField({ name: 'monthlyQuota', type: 'number', initialValue: 3 }),
        defineField({ name: 'publishedThisMonth', type: 'number', initialValue: 0 }),
        defineField({ name: 'periodStart', type: 'datetime' }),
        defineField({ name: 'periodEnd', type: 'datetime' }),
        defineField({
          name: 'status',
          type: 'string',
          options: { list: ['active', 'paused', 'stopped'] },
          initialValue: 'active'
        }),
        defineField({
          name: 'billingStatus',
          type: 'string',
          options: { list: ['n/a', 'trial', 'active', 'overdue', 'canceled'] },
          initialValue: 'trial'
        })
      ]
    })
  ]
});
