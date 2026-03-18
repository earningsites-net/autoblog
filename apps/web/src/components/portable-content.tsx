import type { TextBlock } from '@web/lib/types';
import type { ReactNode } from 'react';

type PortableTextChild = {
  _key?: string;
  _type?: string;
  text?: string;
  marks?: string[];
};

type PortableTextMarkDef = {
  _key?: string;
  _type?: string;
  href?: string;
  nofollow?: boolean;
};

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*.+?\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`bold-${match.index}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <a
          key={`link-${match.index}`}
          href={match[3] || undefined}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="underline decoration-current/45 underline-offset-2"
        >
          {match[2] || token}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function applyInlineMarks(
  baseNode: ReactNode,
  marks: string[],
  markDefsByKey: Map<string, PortableTextMarkDef>,
  keyPrefix: string
) {
  let node = baseNode;

  for (let markIndex = 0; markIndex < marks.length; markIndex += 1) {
    const mark = marks[markIndex];
    if (!mark) continue;
    const markDef = markDefsByKey.get(mark);

    if (mark === 'strong') {
      node = (
        <strong key={`${keyPrefix}-strong-${markIndex}`} className="font-semibold">
          {node}
        </strong>
      );
    } else if (mark === 'em') {
      node = (
        <em key={`${keyPrefix}-em-${markIndex}`} className="italic">
          {node}
        </em>
      );
    } else if (markDef?._type === 'link') {
      const href = String(markDef.href || '').trim();
      const rel = markDef.nofollow === false ? 'noopener noreferrer' : 'nofollow noopener noreferrer';
      node = (
        <a
          key={`${keyPrefix}-link-${markIndex}`}
          href={href || undefined}
          target="_blank"
          rel={rel}
          className="underline decoration-current/45 underline-offset-2"
        >
          {node}
        </a>
      );
    }
  }

  return node;
}

export function PortableContent({ blocks }: { blocks: TextBlock[] }) {
  return (
    <div className="space-y-5 text-base leading-8 text-ink/85">
      {blocks.map((block) => {
        const children = Array.isArray(block.children) ? (block.children as PortableTextChild[]) : [];
        const markDefsByKey = new Map<string, PortableTextMarkDef>(
          (Array.isArray(block.markDefs) ? block.markDefs : [])
            .filter((def) => Boolean(def?._key))
            .map((def) => [String(def._key), def as PortableTextMarkDef])
        );
        const content = children.map((child, index) => {
          const baseNode = <>{renderInlineMarkdown(String(child.text || ''))}</>;
          const marks = Array.isArray(child.marks) ? child.marks : [];
          return (
            <span key={child._key || `${block._key}-child-${index}`}>
              {marks.length ? applyInlineMarks(baseNode, marks, markDefsByKey, `${block._key}-child-${index}`) : baseNode}
            </span>
          );
        });

        if (block.style === 'h2') {
          return (
            <h2 key={block._key} className="mt-10 font-display text-2xl leading-tight text-ink sm:text-3xl">
              {content}
            </h2>
          );
        }
        if (block.style === 'h3') {
          return (
            <h3 key={block._key} className="mt-8 font-display text-xl text-ink sm:text-2xl">
              {content}
            </h3>
          );
        }
        return (
          <p key={block._key} className="text-[1.02rem] leading-8 text-ink/85">
            {content}
          </p>
        );
      })}
    </div>
  );
}
