import type { TextBlock } from '@web/lib/types';
import type { ReactNode } from 'react';

function renderInlineBold(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong key={`bold-${match.index}`} className="font-semibold">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function PortableContent({ blocks }: { blocks: TextBlock[] }) {
  return (
    <div className="space-y-5 text-base leading-8 text-ink/85">
      {blocks.map((block) => {
        const text = block.children.map((child) => child.text).join('');
        if (block.style === 'h2') {
          return (
            <h2 key={block._key} className="mt-10 font-display text-2xl leading-tight text-ink sm:text-3xl">
              {renderInlineBold(text)}
            </h2>
          );
        }
        if (block.style === 'h3') {
          return (
            <h3 key={block._key} className="mt-8 font-display text-xl text-ink sm:text-2xl">
              {renderInlineBold(text)}
            </h3>
          );
        }
        return (
          <p key={block._key} className="text-[1.02rem] leading-8 text-ink/85">
            {renderInlineBold(text)}
          </p>
        );
      })}
    </div>
  );
}
