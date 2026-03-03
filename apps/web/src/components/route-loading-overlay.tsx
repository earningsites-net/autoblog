'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const MIN_VISIBLE_MS = 280;
const SAFETY_TIMEOUT_MS = 8000;

export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [loading, setLoading] = useState(false);
  const currentRouteRef = useRef(routeKey);
  const startedAtRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#')) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;

      startedAtRef.current = Date.now();
      setLoading(true);

      if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = window.setTimeout(() => {
        setLoading(false);
        startedAtRef.current = null;
        safetyTimeoutRef.current = null;
      }, SAFETY_TIMEOUT_MS);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (routeKey === currentRouteRef.current) return;
    currentRouteRef.current = routeKey;

    if (!loading) return;

    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : MIN_VISIBLE_MS;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    const timeoutId = window.setTimeout(() => {
      setLoading(false);
      startedAtRef.current = null;
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    }, remaining);

    return () => window.clearTimeout(timeoutId);
  }, [loading, routeKey]);

  if (!loading) return null;

  return (
    <div className="route-loading-overlay fixed inset-0 z-[120] grid place-items-center">
      <span className="route-loading-spinner block h-10 w-10 animate-spin rounded-full border-[3px] border-solid border-current border-t-transparent" />
    </div>
  );
}
