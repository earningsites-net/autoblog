import { ArticleCard } from './article-card';
import type { Article } from '@web/lib/types';
import Link from 'next/link';
import { siteConfig } from '@web/lib/site';

export function MagazineHero({ articles }: { articles: Article[] }) {
  const [main, ...rest] = articles;

  if (!main) {
    return (
      <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white p-8 shadow-card sm:p-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rust">Editorial Engine Ready</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          {`AI-Powered ${siteConfig.niche} Content, Ready to Publish`}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/75">
          Connect Sanity + n8n to start publishing automated evergreen guides. This layout already includes SEO metadata, schema, and ad placeholders.
        </p>
        <Link href="/categories" className="mt-8 inline-flex rounded-full bg-coal px-5 py-3 text-sm font-medium text-paper hover:bg-coal/90">
          Browse categories
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
      <ArticleCard article={main} featured />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
        {rest.slice(0, 4).map((article) => (
          <ArticleCard key={article._id} article={article} />
        ))}
      </div>
    </section>
  );
}
