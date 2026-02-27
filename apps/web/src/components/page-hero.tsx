import type { ReactNode } from 'react';

export function PageHero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white p-8 shadow-card sm:p-10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rust via-sage to-rust" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rust">{eyebrow}</p>
      <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-ink/75">{description}</p>
      {actions ? <div className="mt-6">{actions}</div> : null}
    </section>
  );
}
