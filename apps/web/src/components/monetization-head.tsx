import { Fragment, createElement } from 'react';

type MonetizationHeadProps = {
  html: string;
  enabled?: boolean;
};

type ParsedHeadNode = {
  tagName: string;
  attributes: Record<string, string | true>;
  innerHtml: string | null;
};

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findTagEnd(html: string, startIndex: number) {
  let quote: '"' | "'" | null = null;
  for (let index = startIndex; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '>') {
      return index;
    }
  }
  return -1;
}

function parseAttributes(source: string) {
  const attributes: Record<string, string | true> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    const [, rawName, doubleQuoted, singleQuoted, unquoted] = match;
    if (!rawName) continue;
    const name = rawName.trim();
    if (!name) continue;
    const resolvedValue = doubleQuoted ?? singleQuoted ?? unquoted;
    attributes[name] = typeof resolvedValue === 'string' ? resolvedValue : true;
  }
  return attributes;
}

function parseOpenTag(rawTag: string) {
  const inner = rawTag.slice(1, -1).trim();
  if (!inner) return null;

  const selfClosing = inner.endsWith('/');
  const normalizedInner = selfClosing ? inner.slice(0, -1).trimEnd() : inner;
  const firstSpaceIndex = normalizedInner.search(/\s/);
  const rawTagName = firstSpaceIndex === -1 ? normalizedInner : normalizedInner.slice(0, firstSpaceIndex);
  const tagName = rawTagName.toLowerCase();
  if (!tagName) return null;

  return {
    tagName,
    attributes: parseAttributes(firstSpaceIndex === -1 ? '' : normalizedInner.slice(firstSpaceIndex + 1)),
    selfClosing
  };
}

function findClosingTag(html: string, tagName: string, fromIndex: number) {
  const pattern = new RegExp(`<\\/\\s*${escapeRegExp(tagName)}\\s*>`, 'i');
  const match = pattern.exec(html.slice(fromIndex));
  if (!match || typeof match.index !== 'number') return null;
  const closingStart = fromIndex + match.index;
  return {
    closingStart,
    closingEnd: closingStart + match[0].length
  };
}

function parseHeadHtml(html: string): ParsedHeadNode[] {
  const nodes: ParsedHeadNode[] = [];
  let index = 0;

  while (index < html.length) {
    if (html.startsWith('<!--', index)) {
      const commentEnd = html.indexOf('-->', index + 4);
      index = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    if (html[index] !== '<') {
      const nextTag = html.indexOf('<', index);
      index = nextTag === -1 ? html.length : nextTag;
      continue;
    }

    if (html[index + 1] === '/') {
      const strayClosingEnd = findTagEnd(html, index + 2);
      index = strayClosingEnd === -1 ? html.length : strayClosingEnd + 1;
      continue;
    }

    const tagEnd = findTagEnd(html, index + 1);
    if (tagEnd === -1) break;

    const openTag = parseOpenTag(html.slice(index, tagEnd + 1));
    index = tagEnd + 1;
    if (!openTag) continue;

    if (openTag.selfClosing || VOID_TAGS.has(openTag.tagName)) {
      nodes.push({
        tagName: openTag.tagName,
        attributes: openTag.attributes,
        innerHtml: null
      });
      continue;
    }

    const closingTag = findClosingTag(html, openTag.tagName, index);
    if (!closingTag) {
      nodes.push({
        tagName: openTag.tagName,
        attributes: openTag.attributes,
        innerHtml: null
      });
      continue;
    }

    nodes.push({
      tagName: openTag.tagName,
      attributes: openTag.attributes,
      innerHtml: html.slice(index, closingTag.closingStart)
    });
    index = closingTag.closingEnd;
  }

  return nodes;
}

function normalizeStyleAttribute(value: string) {
  return value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((styles, declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) return styles;
      const property = declaration.slice(0, separatorIndex).trim();
      const propertyValue = declaration.slice(separatorIndex + 1).trim();
      if (!property || !propertyValue) return styles;
      const reactProperty = property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      styles[reactProperty] = propertyValue;
      return styles;
    }, {});
}

function normalizeAttributeName(name: string) {
  const normalized = name.toLowerCase();
  switch (normalized) {
    case 'class':
      return 'className';
    case 'for':
      return 'htmlFor';
    case 'charset':
      return 'charSet';
    case 'crossorigin':
      return 'crossOrigin';
    case 'httpequiv':
    case 'http-equiv':
      return 'httpEquiv';
    case 'fetchpriority':
      return 'fetchPriority';
    case 'referrerpolicy':
      return 'referrerPolicy';
    case 'nomodule':
      return 'noModule';
    case 'tabindex':
      return 'tabIndex';
    default:
      return name;
  }
}

function toReactProps(attributes: Record<string, string | true>) {
  const props: Record<string, string | boolean | Record<string, string>> = {};

  for (const [name, value] of Object.entries(attributes)) {
    const propName = normalizeAttributeName(name);
    if (propName === 'style' && typeof value === 'string') {
      props.style = normalizeStyleAttribute(value);
      continue;
    }
    props[propName] = value === true ? true : value;
  }

  return props;
}

export function MonetizationHead({ html, enabled = true }: MonetizationHeadProps) {
  if (!enabled || !html.trim()) {
    return null;
  }

  const nodes = parseHeadHtml(html);
  if (!nodes.length) {
    return null;
  }

  return (
    <Fragment>
      {nodes.map((node, index) => {
        const props = {
          ...toReactProps(node.attributes),
          key: `${node.tagName}-${index}`
        } as Record<string, unknown>;

        if (typeof node.innerHtml === 'string') {
          props.dangerouslySetInnerHTML = { __html: node.innerHtml };
        }

        return createElement(node.tagName, props);
      })}
    </Fragment>
  );
}
