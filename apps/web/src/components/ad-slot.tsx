'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type AdSlotKey = 'header' | 'inContent' | 'footer';

type AdSlotProps = {
  name: string;
  className?: string;
  minHeight?: number;
  slotKey?: AdSlotKey;
  slotOverride?: string;
};

type RuntimeAdConfig = {
  enabled: boolean;
  publisher: string;
  mode: 'auto' | 'manual' | 'hybrid';
  previewEnabled: boolean;
  recipe: string;
  isDark: boolean;
  slots: {
    header: string;
    inContent: string;
    footer: string;
  };
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const SSR_SAFE_RUNTIME: RuntimeAdConfig = {
  enabled: false,
  publisher: '',
  mode: 'auto',
  previewEnabled: true,
  recipe: 'bold_magazine',
  isDark: false,
  slots: { header: '', inContent: '', footer: '' }
};

function readRuntimeConfig(): RuntimeAdConfig {
  if (typeof document === 'undefined') {
    return SSR_SAFE_RUNTIME;
  }

  const root = document.documentElement;
  const recipe = String(root.dataset.themeRecipe || 'bold_magazine');
  const isDark = ['noir_luxury_dark', 'midnight_wellness_dark', 'arcade_play_dark'].includes(recipe);
  return {
    enabled: String(root.dataset.adsEnabled || '') === 'true',
    publisher: String(root.dataset.adsensePublisher || '').trim(),
    mode:
      root.dataset.adsMode === 'manual' || root.dataset.adsMode === 'hybrid' || root.dataset.adsMode === 'auto'
        ? root.dataset.adsMode
        : 'auto',
    previewEnabled: String(root.dataset.adsPreviewEnabled || '') === 'true',
    recipe,
    isDark,
    slots: {
      header: String(root.dataset.adsSlotHeader || '').trim(),
      inContent: String(root.dataset.adsSlotInContent || '').trim(),
      footer: String(root.dataset.adsSlotFooter || '').trim()
    }
  };
}

export function AdSlot({ name, className = '', minHeight = 280, slotKey = 'inContent', slotOverride }: AdSlotProps) {
  const style = { minHeight };
  const [runtime, setRuntime] = useState<RuntimeAdConfig>(SSR_SAFE_RUNTIME);
  const { recipe, isDark } = runtime;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';

  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    setRuntime(readRuntimeConfig());
  }, []);

  const slotId = useMemo(() => {
    if (slotOverride) return slotOverride.trim();
    return runtime.slots[slotKey] || '';
  }, [runtime.slots, slotKey, slotOverride]);

  const liveSlotEnabled =
    runtime.enabled &&
    runtime.publisher &&
    Boolean(slotId) &&
    (runtime.mode === 'manual' || runtime.mode === 'hybrid');

  useEffect(() => {
    if (!liveSlotEnabled) return;

    const element = adRef.current;
    if (!element) return;
    if (element.dataset.loaded === 'true') return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      element.dataset.loaded = 'true';
    } catch {
      // Keep graceful fallback rendering.
    }
  }, [liveSlotEnabled]);

  const disabledClass = isDark
    ? `grid w-full place-items-center border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-2xl'}`
    : recipe === 'editorial_luxury'
      ? 'grid w-full place-items-center border border-dashed border-black/10 bg-black/[0.02] px-4 py-8 text-center'
      : 'grid w-full place-items-center rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-8 text-center';

  const enabledClass = isDark
    ? `border border-white/15 bg-coal/75 ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-2xl'}`
    : recipe === 'editorial_luxury'
      ? 'border border-black/10 bg-white'
      : 'rounded-2xl border border-black/10 bg-white';

  const labelClass = isDark ? 'text-[10px] font-semibold uppercase tracking-[0.25em] text-paper/55' : 'text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/50';
  const textClass = isDark ? 'mt-2 text-sm text-paper/75' : 'mt-2 text-sm text-ink/70';

  if (runtime.mode === 'auto') {
    // In pure Auto Ads mode, Google injects placements automatically.
    // We avoid rendering manual slot containers to prevent empty layout gaps.
    return null;
  }

  if (!liveSlotEnabled) {
    return (
      <div className={`${disabledClass} ${className}`} style={style} aria-label={`${name} placeholder`}>
        <div>
          <p className={labelClass}>Ad Slot</p>
          <p className={textClass}>{name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${enabledClass} ${className}`} style={style} aria-label={name}>
      <ins
        ref={adRef}
        className="adsbygoogle block h-full w-full"
        style={{ display: 'block', minHeight: `${minHeight}px` }}
        data-ad-client={runtime.publisher}
        data-ad-slot={slotId}
        data-adtest={runtime.previewEnabled ? 'on' : undefined}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
