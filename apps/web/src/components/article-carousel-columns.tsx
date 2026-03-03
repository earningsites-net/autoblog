'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Article } from '@web/lib/types';

function splitInThreeLanes(items: Article[]) {
  const lanes: Article[][] = [[], [], []];
  for (let i = 0; i < items.length; i += 1) {
    const lane = lanes[i % 3];
    const item = items[i];
    if (lane && item) lane.push(item);
  }
  return lanes;
}

export function ArticleCarouselColumns({
  articles,
  isDark,
  recipe,
  carouselEyebrow,
  carouselTitle
}: {
  articles: Article[];
  isDark: boolean;
  recipe: string;
  carouselEyebrow: string;
  carouselTitle: string;
}) {
  const source = articles.slice(0, 12);
  const lanes = useMemo(() => splitInThreeLanes(source), [source]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return undefined;
    const id = window.setInterval(() => {
      setStep((prev) => prev + 1);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  if (source.length < 3 || lanes.some((lane) => lane.length === 0)) return null;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';

  const frameClass = isDark
    ? `border border-white/15 bg-coal/80 p-4 shadow-[0_20px_56px_-34px_rgba(0,0,0,0.78)] ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-[1.6rem]'}`
    : recipe === 'editorial_luxury'
      ? 'border border-black/10 bg-white/95 p-4 shadow-card'
      : 'rounded-[1.6rem] border border-black/10 bg-white/95 p-4 shadow-card';
  const cardClass = isDark
    ? `autoblog-lane-enter flex h-full flex-col overflow-hidden border border-white/12 bg-black/30 p-3 text-paper ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-lg' : 'rounded-xl'}`
    : recipe === 'editorial_luxury'
      ? 'autoblog-lane-enter flex h-full flex-col overflow-hidden border border-black/10 bg-paper/60 p-3 text-ink'
      : recipe === 'warm_wellness'
        ? 'autoblog-lane-enter flex h-full flex-col overflow-hidden rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-ink'
      : 'autoblog-lane-enter flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-paper/60 p-3 text-ink';
  const accentClass = recipe === 'warm_wellness' ? 'text-rose-500' : 'text-rust';
  const excerptClass = isDark ? 'text-paper/75' : 'text-ink/75';

  return (
    <section className="space-y-5">
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClass}`}>{carouselEyebrow}</p>
        <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{carouselTitle}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {lanes.map((lane, laneIndex) => {
          const active = lane[step % lane.length];
          if (!active) return null;
          return (
            <div key={`lane-${laneIndex}`} className={frameClass}>
              <Link key={`${active._id}-${step}`} href={`/articles/${active.slug}`} className={cardClass}>
                <div className={`relative h-44 overflow-hidden ${recipe === 'editorial_luxury' || isNoirSharp ? '' : 'rounded-lg'}`}>
                  <Image src={active.coverImage} alt={active.coverImageAlt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 30vw" />
                </div>
                <p className={`mt-3 text-[10px] uppercase tracking-[0.14em] ${accentClass}`}>{active.category.title}</p>
                <p className="mt-2 line-clamp-2 font-display text-xl leading-[1.18]">{active.title}</p>
                <p className={`mt-2 line-clamp-3 text-sm leading-6 ${excerptClass}`}>{active.excerpt}</p>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
