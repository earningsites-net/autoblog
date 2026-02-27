import type { FAQItem } from '@web/lib/types';

export function FAQList({ items }: { items: FAQItem[] }) {
  if (!items.length) return null;

  return (
    <section className="mt-12 rounded-3xl border border-black/5 bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-2xl text-ink">Frequently Asked Questions</h2>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <details key={item.question} className="group rounded-2xl border border-black/5 bg-paper p-4 open:bg-white">
            <summary className="cursor-pointer list-none font-medium text-ink">
              <span className="inline-flex items-start gap-3">
                <span className="mt-1 text-rust">+</span>
                <span>{item.question}</span>
              </span>
            </summary>
            <p className="mt-3 pl-6 text-sm leading-6 text-ink/75">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
