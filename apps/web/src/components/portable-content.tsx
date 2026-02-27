import type { TextBlock } from '@web/lib/types';

export function PortableContent({ blocks }: { blocks: TextBlock[] }) {
  return (
    <div className="space-y-5 text-base leading-8 text-ink/85">
      {blocks.map((block) => {
        const text = block.children.map((child) => child.text).join('');
        if (block.style === 'h2') {
          return (
            <h2 key={block._key} className="mt-10 font-display text-2xl leading-tight text-ink sm:text-3xl">
              {text}
            </h2>
          );
        }
        if (block.style === 'h3') {
          return (
            <h3 key={block._key} className="mt-8 font-display text-xl text-ink sm:text-2xl">
              {text}
            </h3>
          );
        }
        return (
          <p key={block._key} className="text-[1.02rem] leading-8 text-ink/85">
            {text}
          </p>
        );
      })}
    </div>
  );
}
