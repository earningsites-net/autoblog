import Link from 'next/link';
import type { Category } from '@web/lib/types';

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category, index) => (
        <Link
          key={category._id}
          href={`/categories/${category.slug}`}
          className="group relative overflow-hidden rounded-3xl border border-black/5 bg-white p-6 shadow-card transition hover:-translate-y-0.5"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-gradient-to-br from-rust/20 to-sage/20 blur-2xl" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/55">Category</p>
          <h3 className="mt-3 font-display text-2xl text-ink group-hover:text-rust">{category.title}</h3>
          <p className="mt-3 text-sm leading-6 text-ink/75">{category.description}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink">
            Browse guides <span aria-hidden className="transition group-hover:translate-x-1">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
