import {
  buildDefaultLegalPageContent,
  parseEditableLegalText,
  type SharedLegalContent,
  type SharedLegalPageKind,
  type SharedLegalSection
} from './legal-content';
import { getPublicSiteSettings, hasConfiguredMonetization } from './site-settings';
import { siteConfig } from './site';

export type LegalPageKind = SharedLegalPageKind;

export type LegalPageSection = SharedLegalSection;

export type LegalPageContent = SharedLegalContent & {
  eyebrow: string;
};

type LegalPageMetadata = {
  title: string;
  description: string;
};

function getOverrideRawText(kind: LegalPageKind, settings: Awaited<ReturnType<typeof getPublicSiteSettings>>) {
  if (kind === 'privacy') return String(settings.privacyPolicyOverride || '').trim();
  if (kind === 'cookie') return String(settings.cookiePolicyOverride || '').trim();
  return String(settings.disclaimerOverride || '').trim();
}

function buildBaseLegalPageContent(kind: LegalPageKind, adsEnabled: boolean): SharedLegalContent {
  return buildDefaultLegalPageContent(kind, {
    siteName: siteConfig.name,
    adsEnabled
  });
}

export function getLegalPageMetadata(kind: LegalPageKind): LegalPageMetadata {
  const content = buildBaseLegalPageContent(kind, false);

  return {
    title: content.title,
    description: content.metadataDescription
  };
}

export async function getLegalPageContent(kind: LegalPageKind): Promise<LegalPageContent> {
  const settings = await getPublicSiteSettings();
  const adsEnabled = hasConfiguredMonetization(settings);
  const defaultContent = buildBaseLegalPageContent(kind, adsEnabled);
  const overrideText = getOverrideRawText(kind, settings);

  if (!overrideText) {
    return {
      eyebrow: 'Legal',
      ...defaultContent
    };
  }

  const customSections = parseEditableLegalText(overrideText, defaultContent.title);
  if (!customSections.length) {
    return {
      eyebrow: 'Legal',
      ...defaultContent
    };
  }

  return {
    eyebrow: 'Legal',
    ...defaultContent,
    sections: customSections,
    summaryTitle: 'Custom policy',
    summaryDescription: 'This page uses site-specific policy text configured by the site owner.',
    summaryItems: [
      'A custom version of this policy is active for this site.',
      'The text shown here may differ from the platform default used on other sites.',
      'Use the contact page if you have questions about this policy.'
    ]
  };
}
