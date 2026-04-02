import type { Metadata } from 'next';
import type { Article } from './types';
import { absoluteUrl, getSiteLogoMonogram, siteConfig } from './site';

function buildSiteMonogramIcon() {
  const monogram = getSiteLogoMonogram();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="${monogram.radius}" fill="${monogram.background}"/>
      <rect x="4" y="4" width="56" height="56" rx="${Math.max(8, monogram.radius - 2)}" fill="none" stroke="${monogram.border}" stroke-width="2" opacity="0.9"/>
      <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="${monogram.foreground}">${monogram.letter}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getSiteIconUrl() {
  return siteConfig.brandAssets.logoUrl || buildSiteMonogramIcon();
}

export function defaultMetadata(): Metadata {
  const iconUrl = getSiteIconUrl();
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`
    },
    description: siteConfig.description,
    openGraph: {
      type: 'website',
      locale: siteConfig.locale,
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: siteConfig.name,
      description: siteConfig.description,
      images: [{ url: siteConfig.defaultOgImage }]
    },
    twitter: {
      card: 'summary_large_image',
      title: siteConfig.name,
      description: siteConfig.description,
      images: [siteConfig.defaultOgImage]
    },
    icons: {
      icon: [{ url: iconUrl }],
      shortcut: [{ url: iconUrl }],
      apple: [{ url: iconUrl }]
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined
    }
  };
}

export function articleMetadata(article: Article): Metadata {
  const path = `/articles/${article.slug}`;
  const url = article.canonicalUrl || absoluteUrl(path);
  const tags = Array.isArray(article.tags) ? article.tags : [];

  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      images: [{ url: article.coverImage, alt: article.coverImageAlt }],
      publishedTime: article.publishedAt,
      tags: tags.map((tag) => tag.title)
    },
    twitter: {
      card: 'summary_large_image',
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      images: [article.coverImage]
    }
  };
}

export function articleJsonLd(article: Article) {
  const url = article.canonicalUrl || absoluteUrl(`/articles/${article.slug}`);
  const tags = Array.isArray(article.tags) ? article.tags : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    inLanguage: siteConfig.locale,
    mainEntityOfPage: url,
    image: [article.coverImage],
    author: article.author
      ? {
          '@type': 'Person',
          name: article.author.name,
          description: article.author.role || article.author.bio || undefined
        }
      : {
          '@type': 'Organization',
          name: siteConfig.name
        },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      logo: {
        '@type': 'ImageObject',
        url: siteConfig.brandAssets.logoUrl || absoluteUrl('/logo-mark.svg')
      }
    },
    articleSection: article.category.title,
    keywords: tags.map((tag) => tag.title).join(', ')
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; item: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.item
    }))
  };
}

export function faqJsonLd(faqItems: Array<{ question: string; answer: string }>) {
  if (!faqItems.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}
