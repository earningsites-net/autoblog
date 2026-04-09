'use client';

import { useEffect, useRef } from 'react';

function cloneNodeWithLiveScripts(documentRef: Document, node: Node): Node {
  if (node.nodeType === Node.TEXT_NODE) {
    return documentRef.createTextNode(node.textContent || '');
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    return documentRef.createComment(node.textContent || '');
  }

  if (!(node instanceof Element)) {
    return documentRef.createTextNode('');
  }

  if (node.tagName.toLowerCase() === 'script') {
    const nextScript = documentRef.createElement('script');
    for (const attribute of Array.from(node.attributes)) {
      nextScript.setAttribute(attribute.name, attribute.value);
    }
    if (node.textContent) {
      nextScript.textContent = node.textContent;
    }
    return nextScript;
  }

  const cloned = documentRef.createElement(node.tagName);
  for (const attribute of Array.from(node.attributes)) {
    cloned.setAttribute(attribute.name, attribute.value);
  }
  for (const child of Array.from(node.childNodes)) {
    cloned.appendChild(cloneNodeWithLiveScripts(documentRef, child));
  }
  return cloned;
}

function parseHtml(documentRef: Document, html: string) {
  const template = documentRef.createElement('template');
  template.innerHTML = html;
  return Array.from(template.content.childNodes);
}

function replaceContainerHtml(container: HTMLElement, html: string) {
  container.replaceChildren();
  if (!html.trim()) return;

  const documentRef = container.ownerDocument;
  const nodes = parseHtml(documentRef, html);
  for (const node of nodes) {
    container.appendChild(cloneNodeWithLiveScripts(documentRef, node));
  }
}

type MonetizationHeadProps = {
  html: string;
  enabled?: boolean;
};

export function MonetizationHead({ html, enabled = true }: MonetizationHeadProps) {
  const insertedNodesRef = useRef<Node[]>([]);

  useEffect(() => {
    const documentRef = document;
    for (const node of insertedNodesRef.current) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
    insertedNodesRef.current = [];

    if (!enabled || !html.trim()) {
      return;
    }

    const nodes = parseHtml(documentRef, html);
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || '').trim()) {
        continue;
      }
      const nextNode = cloneNodeWithLiveScripts(documentRef, node);
      documentRef.head.appendChild(nextNode);
      insertedNodesRef.current.push(nextNode);
    }

    return () => {
      for (const node of insertedNodesRef.current) {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
      insertedNodesRef.current = [];
    };
  }, [enabled, html]);

  return null;
}

type MonetizationSlotProps = {
  html: string;
  enabled?: boolean;
  className?: string;
  minHeight?: number;
  label?: string;
};

export function MonetizationSlot({
  html,
  enabled = true,
  className = '',
  minHeight,
  label
}: MonetizationSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    replaceContainerHtml(container, enabled ? html : '');
  }, [enabled, html]);

  if (!enabled || !html.trim()) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={typeof minHeight === 'number' ? { minHeight } : undefined}
      aria-label={label}
    />
  );
}
