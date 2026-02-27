import Image from 'next/image';
import Link from 'next/link';
import type { Article } from '@web/lib/types';
import { formatDate } from '@web/lib/site';

export function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  return (
    <article className={`group overflow-hidden rounded-3xl border border-black/5 bg-white shadow-card ${featured ? '' : ''}`}>
      <Link href={`/articles/${article.slug}`} className="block">
        <div className={`relative ${featured ? 'aspect-[16/10]' : 'aspect-[16/11]'} overflow-hidden`}>
          <Image
            src={article.coverImage}
            alt={article.coverImageAlt}
            fill
            sizes={featured ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 768px) 100vw, 33vw'}
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-ink">
            {article.category.title}
          </span>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink/60">
            <span>{formatDate(article.publishedAt)}</span>
            <span aria-hidden>•</span>
            <span>{article.readTimeMinutes} min read</span>
            <span aria-hidden>•</span>
            <span>QA {article.qaScore}</span>
          </div>
          <h3 className={`mt-3 font-display text-ink transition group-hover:text-rust ${featured ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
            {article.title}
          </h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/75">{article.excerpt}</p>
        </div>
      </Link>
    </article>
  );
}
