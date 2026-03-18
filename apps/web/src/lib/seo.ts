import type { Metadata } from 'next';
import type { Article } from './types';
import { absoluteUrl, siteConfig } from './site';

export function defaultMetadata(): Metadata {
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
        url: absoluteUrl('/logo-mark.svg')
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
