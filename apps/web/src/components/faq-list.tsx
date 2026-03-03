import type { FAQItem } from '@web/lib/types';
import { getActiveSiteTheme } from '@web/lib/theme';

export function FAQList({ items }: { items: FAQItem[] }) {
  if (!items.length) return null;
  const theme = getActiveSiteTheme();
  const isDark = theme.isDark;
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const sectionClass = isDark
    ? isNoirSharp
      ? 'mt-12 border border-white/15 bg-coal/70 p-6 shadow-[0_20px_52px_-30px_rgba(0,0,0,0.72)] sm:p-8'
      : isArcadeSoft
        ? 'mt-12 rounded-xl border border-white/15 bg-coal/70 p-6 shadow-[0_20px_52px_-30px_rgba(0,0,0,0.72)] sm:p-8'
        : 'mt-12 rounded-3xl border border-white/15 bg-coal/70 p-6 shadow-[0_20px_52px_-30px_rgba(0,0,0,0.72)] sm:p-8'
    : recipe === 'editorial_luxury'
      ? 'mt-12 border border-black/5 bg-white p-6 shadow-card sm:p-8'
      : recipe === 'warm_wellness'
        ? 'mt-12 rounded-xl border border-rose-200 bg-white p-6 shadow-card sm:p-8'
      : 'mt-12 rounded-3xl border border-black/5 bg-white p-6 shadow-card sm:p-8';
  const questionClass = isDark
    ? isNoirSharp
      ? 'group border border-white/12 bg-black/25 p-4 open:bg-black/35'
      : isArcadeSoft
        ? 'group rounded-lg border border-white/12 bg-black/25 p-4 open:bg-black/35'
        : 'group rounded-2xl border border-white/12 bg-black/25 p-4 open:bg-black/35'
    : recipe === 'editorial_luxury'
      ? 'group border border-black/5 bg-paper p-4 open:bg-white'
      : recipe === 'warm_wellness'
        ? 'group rounded-lg border border-rose-200 bg-rose-50/60 p-4 open:bg-rose-50'
      : 'group rounded-2xl border border-black/5 bg-paper p-4 open:bg-white';
  const answerClass = isDark ? 'mt-3 pl-6 text-sm leading-6 text-paper/78' : 'mt-3 pl-6 text-sm leading-6 text-ink/75';
  const accentClass = recipe === 'warm_wellness' ? 'text-rose-500' : 'text-rust';

  return (
    <section className={sectionClass}>
      <h2 className="font-display text-2xl text-ink">Frequently Asked Questions</h2>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <details key={item.question} className={questionClass}>
            <summary className="cursor-pointer list-none font-medium text-ink">
              <span className="inline-flex items-start gap-3">
                <span className={`mt-1 ${accentClass}`}>+</span>
                <span>{item.question}</span>
              </span>
            </summary>
            <p className={answerClass}>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
