import Image from 'next/image';
import Link from 'next/link';
import type { Article, TextBlock } from '@web/lib/types';
import { formatDate } from '@web/lib/site';
import { getActiveSiteTheme } from '@web/lib/theme';
import type { CSSProperties, ReactNode } from 'react';

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


function normalizePreviewText(input: string) {
  return String(input || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const full = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if ((full.startsWith('**') && full.endsWith('**')) || (full.startsWith('__') && full.endsWith('__'))) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${matchIndex}`} className="font-semibold">
          {full.slice(2, -2)}
        </strong>
      );
    } else if ((full.startsWith('*') && full.endsWith('*')) || (full.startsWith('_') && full.endsWith('_'))) {
      nodes.push(
        <em key={`${keyPrefix}-em-${matchIndex}`} className="italic">
          {full.slice(1, -1)}
        </em>
      );
    } else if (full.startsWith('`') && full.endsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-code-${matchIndex}`} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]">
          {full.slice(1, -1)}
        </code>
      );
    } else if (full.startsWith('[')) {
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const linkLabel = linkMatch?.[1] || full;
      const href = String(linkMatch?.[2] || '').trim();
      nodes.push(
        <a
          key={`${keyPrefix}-link-${matchIndex}`}
          href={href || undefined}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="underline decoration-current/45 underline-offset-2"
        >
          {linkLabel}
        </a>
      );
    } else {
      nodes.push(full);
    }

    lastIndex = start + full.length;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderMarkdownBlocks(markdown: string, keyPrefix: string) {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, blockIndex) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length && lines.every((line) => /^[-*+]\s+/.test(line))) {
      return (
        <ul key={`${keyPrefix}-ul-${blockIndex}`} className="list-disc pl-5">
          {lines.map((line, lineIndex) => (
            <li key={`${keyPrefix}-uli-${blockIndex}-${lineIndex}`}>
              {renderInlineMarkdown(line.replace(/^[-*+]\s+/, ''), `${keyPrefix}-uli-${blockIndex}-${lineIndex}`)}
            </li>
          ))}
        </ul>
      );
    }

    if (lines.length && lines.every((line) => /^\d+\.\s+/.test(line))) {
      return (
        <ol key={`${keyPrefix}-ol-${blockIndex}`} className="list-decimal pl-5">
          {lines.map((line, lineIndex) => (
            <li key={`${keyPrefix}-oli-${blockIndex}-${lineIndex}`}>
              {renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''), `${keyPrefix}-oli-${blockIndex}-${lineIndex}`)}
            </li>
          ))}
        </ol>
      );
    }

    if (/^###\s+/.test(block)) {
      return (
        <h4 key={`${keyPrefix}-h4-${blockIndex}`} className="font-display text-lg leading-tight">
          {renderInlineMarkdown(block.replace(/^###\s+/, ''), `${keyPrefix}-h4-${blockIndex}`)}
        </h4>
      );
    }

    if (/^##\s+/.test(block)) {
      return (
        <h3 key={`${keyPrefix}-h3-${blockIndex}`} className="font-display text-xl leading-tight">
          {renderInlineMarkdown(block.replace(/^##\s+/, ''), `${keyPrefix}-h3-${blockIndex}`)}
        </h3>
      );
    }

    if (/^#\s+/.test(block)) {
      return (
        <h2 key={`${keyPrefix}-h2-${blockIndex}`} className="font-display text-2xl leading-tight">
          {renderInlineMarkdown(block.replace(/^#\s+/, ''), `${keyPrefix}-h2-${blockIndex}`)}
        </h2>
      );
    }

    return (
      <p key={`${keyPrefix}-p-${blockIndex}`}>
        {renderInlineMarkdown(lines.join(' '), `${keyPrefix}-p-${blockIndex}`)}
      </p>
    );
  });
}

function applyInlineMarks(
  baseNode: ReactNode,
  marks: string[],
  markDefsByKey: Map<string, PortableTextMarkDef>,
  keyPrefix: string
) {
  let node = baseNode;
  let markIndex = 0;

  for (const mark of marks) {
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
    } else if (mark === 'code') {
      node = (
        <code key={`${keyPrefix}-code-${markIndex}`} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]">
          {node}
        </code>
      );
    } else if (mark === 'underline') {
      node = (
        <span key={`${keyPrefix}-underline-${markIndex}`} className="underline decoration-current/45 underline-offset-2">
          {node}
        </span>
      );
    } else if (mark === 'strike-through') {
      node = (
        <span key={`${keyPrefix}-strike-${markIndex}`} className="line-through">
          {node}
        </span>
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

    markIndex += 1;
  }

  return node;
}

function renderPortableBlocks(blocks: TextBlock[], keyPrefix: string) {
  const elements: ReactNode[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    if (!block || block._type !== 'block') continue;

    const children = Array.isArray(block.children) ? block.children : [];
    const markDefsByKey = new Map<string, PortableTextMarkDef>(
      (Array.isArray(block.markDefs) ? block.markDefs : [])
        .filter((def) => Boolean(def?._key))
        .map((def) => [String(def._key), def])
    );

    const inlineNodes: ReactNode[] = [];
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const child = children[childIndex];
      if (!child || child._type !== 'span') continue;
      const text = String(child.text || '');
      if (!text) continue;

      const marks = Array.isArray(child.marks) ? child.marks : [];
      const inlineMarkdownFallback = renderInlineMarkdown(text, `${keyPrefix}-b${blockIndex}-c${childIndex}`);
      const baseInlineNode: ReactNode = <>{inlineMarkdownFallback}</>;
      inlineNodes.push(
        <span key={`${keyPrefix}-span-${blockIndex}-${childIndex}`}>
          {marks.length > 0
            ? applyInlineMarks(baseInlineNode, marks, markDefsByKey, `${keyPrefix}-span-${blockIndex}-${childIndex}`)
            : baseInlineNode}
        </span>
      );
    }

    if (!inlineNodes.length) continue;

    const content = <>{inlineNodes}</>;
    const style = block.style || 'normal';

    if (block.listItem === 'bullet') {
      elements.push(
        <p key={`${keyPrefix}-bul-${blockIndex}`} className="pl-5 before:mr-2 before:content-['•']">
          {content}
        </p>
      );
      continue;
    }

    if (block.listItem === 'number') {
      elements.push(
        <p key={`${keyPrefix}-num-${blockIndex}`} className="pl-5">
          {content}
        </p>
      );
      continue;
    }

    if (style === 'h2') {
      elements.push(
        <h3 key={`${keyPrefix}-h2-${blockIndex}`} className="font-display text-xl leading-tight">
          {content}
        </h3>
      );
      continue;
    }

    if (style === 'h3') {
      elements.push(
        <h4 key={`${keyPrefix}-h3-${blockIndex}`} className="font-display text-lg leading-tight">
          {content}
        </h4>
      );
      continue;
    }

    elements.push(<p key={`${keyPrefix}-p-${blockIndex}`}>{content}</p>);
  }

  return elements;
}

type ArticleCardProps = {
  article: Article;
  featured?: boolean;
  showFullExcerpt?: boolean;
  fillHeight?: boolean;
  preferBodyPreview?: boolean;
  excerptClampLines?: number;
};

export function ArticleCard({
  article,
  featured = false,
  showFullExcerpt = false,
  fillHeight = false,
  preferBodyPreview = false,
  excerptClampLines
}: ArticleCardProps) {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isDark = theme.isDark;

  const frameClass =
    isDark
      ? 'border border-white/15 bg-coal/80 shadow-[0_24px_56px_-30px_rgba(0,0,0,0.72)]'
      : recipe === 'editorial_luxury'
      ? 'border border-black/15 bg-white/95 shadow-[0_24px_60px_-30px_rgba(10,10,10,0.4)]'
      : recipe === 'warm_wellness'
        ? 'border border-rose-200 bg-white shadow-[0_24px_55px_-30px_rgba(170,105,140,0.28)]'
        : recipe === 'playful_kids'
          ? 'border-2 border-rust/30 bg-white shadow-[0_24px_48px_-26px_rgba(180,95,60,0.35)]'
          : recipe === 'technical_minimal'
            ? 'border border-black/20 bg-white shadow-none'
            : '';

  const chipClass =
    isDark
      ? 'bg-black/35 text-paper border border-white/25'
      : recipe === 'editorial_luxury'
      ? 'bg-paper/95 text-ink border border-black/10'
      : recipe === 'warm_wellness'
        ? 'bg-rose-100 text-ink border border-rose-200'
        : recipe === 'playful_kids'
          ? 'bg-rust/20 text-ink border border-rust/30'
          : recipe === 'technical_minimal'
            ? 'bg-coal text-paper rounded-md'
            : 'bg-paper/90 text-ink';

  const imageRatio = recipe === 'technical_minimal' ? (featured ? 'aspect-[16/9]' : 'aspect-[16/10]') : featured ? 'aspect-[16/10]' : 'aspect-[16/11]';
  const imageHover = recipe === 'technical_minimal' ? 'group-hover:scale-[1.01]' : 'group-hover:scale-[1.03]';
  const titleClass =
    recipe === 'editorial_luxury'
      ? featured
        ? 'text-[2.15rem] leading-[1.15]'
        : 'text-[1.35rem] leading-[1.25]'
      : recipe === 'technical_minimal'
        ? featured
          ? 'text-[1.7rem] leading-[1.2]'
          : 'text-[1.1rem] leading-[1.35]'
        : featured
          ? 'text-2xl sm:text-3xl'
          : 'text-xl';
  const bodyPreview = normalizePreviewText(
    article.body
      .map((block) => block.children.map((child) => child.text).join(' ').trim())
      .filter(Boolean)
      .join('\n\n')
  );
  const excerptPreview = normalizePreviewText(article.excerpt);
  const previewText = preferBodyPreview && bodyPreview ? bodyPreview : excerptPreview;
  const clampLines = showFullExcerpt || fillHeight ? undefined : excerptClampLines ?? 3;
  const portablePreview = preferBodyPreview ? renderPortableBlocks(article.body, `article-portable-${article._id}`) : [];
  const markdownPreview = preferBodyPreview ? renderMarkdownBlocks(previewText, `article-markdown-${article._id}`) : null;
  const excerptStyle: CSSProperties | undefined =
    typeof clampLines === 'number'
      ? {
          display: '-webkit-box',
          WebkitLineClamp: clampLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }
      : undefined;
  const excerptClass =
    isDark
      ? `mt-3 text-sm leading-6 text-paper/80 ${fillHeight ? 'flex-1 overflow-hidden [mask-image:linear-gradient(180deg,#000_72%,transparent)] [-webkit-mask-image:linear-gradient(180deg,#000_72%,transparent)]' : ''}`
      : recipe === 'technical_minimal'
      ? `mt-3 text-sm leading-6 text-ink/80 ${fillHeight ? 'flex-1 overflow-hidden [mask-image:linear-gradient(180deg,#000_72%,transparent)] [-webkit-mask-image:linear-gradient(180deg,#000_72%,transparent)]' : ''}`
      : `mt-3 text-sm leading-6 text-ink/75 ${fillHeight ? 'flex-1 overflow-hidden [mask-image:linear-gradient(180deg,#000_72%,transparent)] [-webkit-mask-image:linear-gradient(180deg,#000_72%,transparent)]' : ''}`;
  const markdownClass = `${excerptClass} [&>*+*]:mt-3`;
  const metaClass = isDark
    ? 'flex flex-wrap items-center gap-3 text-xs text-paper/65'
    : recipe === 'technical_minimal'
      ? 'flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-ink/55'
      : 'flex flex-wrap items-center gap-3 text-xs text-ink/60';
  const bodyPad = recipe === 'editorial_luxury' ? 'p-6 sm:p-7' : 'p-5 sm:p-6';
  const overlayClass = isDark
    ? 'absolute inset-0 bg-gradient-to-t from-black/52 via-black/20 to-transparent'
    : recipe === 'technical_minimal'
      ? 'absolute inset-0 bg-gradient-to-t from-black/8 via-transparent to-transparent'
      : 'absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent';
  const badgeShape =
    recipe === 'editorial_luxury' || recipe === 'noir_luxury_dark'
      ? 'rounded-none'
      : recipe === 'arcade_play_dark'
        ? 'rounded-md'
      : recipe === 'technical_minimal'
        ? 'rounded-md'
        : 'rounded-full';
  const titleToneClass = isDark
    ? 'text-paper group-hover:text-rust'
    : recipe === 'warm_wellness'
      ? 'text-ink group-hover:text-rose-500'
      : 'text-ink group-hover:text-rust';
  const linkClass = fillHeight ? 'block h-full' : 'block';
  const bodyClass = fillHeight ? `${bodyPad} flex min-h-0 flex-1 flex-col` : bodyPad;
  const articleClass = fillHeight ? `${theme.classes.articleCard} ${frameClass} h-full` : `${theme.classes.articleCard} ${frameClass}`;

  return (
    <article className={articleClass}>
      <Link href={`/articles/${article.slug}`} className={linkClass}>
        <div className={`relative ${imageRatio} overflow-hidden`}>
          <Image
            src={article.coverImage}
            alt={article.coverImageAlt}
            fill
            sizes={featured ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 768px) 100vw, 33vw'}
            className={`object-cover transition duration-500 ${imageHover}`}
          />
          <div className={overlayClass} />
          <span
            className={`absolute left-4 top-4 ${badgeShape} ${chipClass} px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]`}
          >
            {article.category.title}
          </span>
        </div>
        <div className={bodyClass}>
          <div className={metaClass}>
            <span>{formatDate(article.publishedAt)}</span>
            <span aria-hidden>•</span>
            <span>{article.readTimeMinutes} min read</span>
          </div>
          <h3 className={`mt-3 font-display transition ${titleToneClass} ${titleClass}`}>
            {article.title}
          </h3>
          {preferBodyPreview ? (
            <div className={markdownClass} style={excerptStyle}>
              {portablePreview.length ? portablePreview : markdownPreview}
            </div>
          ) : (
            <p className={excerptClass} style={excerptStyle}>
              {previewText}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
