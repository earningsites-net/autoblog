import { featureFlags } from '@web/lib/site';
import { getActiveSiteTheme } from '@web/lib/theme';

type AdSlotProps = {
  name: string;
  className?: string;
  minHeight?: number;
};

export function AdSlot({ name, className = '', minHeight = 280 }: AdSlotProps) {
  const style = { minHeight };
  const theme = getActiveSiteTheme();
  const isDark = theme.isDark;
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';

  if (!featureFlags.adSlots) {
    const disabledClass = isDark
      ? `grid w-full place-items-center border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-2xl'}`
      : recipe === 'editorial_luxury'
        ? 'grid w-full place-items-center border border-dashed border-black/10 bg-black/[0.02] px-4 py-8 text-center'
        : 'grid w-full place-items-center rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-8 text-center';
    const labelClass = isDark ? 'text-[10px] font-semibold uppercase tracking-[0.25em] text-paper/55' : 'text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/50';
    const nameClass = isDark ? 'mt-2 text-sm text-paper/75' : 'mt-2 text-sm text-ink/70';
    return (
      <div
        className={`${disabledClass} ${className}`}
        style={style}
        aria-label={`${name} placeholder`}
      >
        <div>
          <p className={labelClass}>Ad Slot (Disabled)</p>
          <p className={nameClass}>{name}</p>
        </div>
      </div>
    );
  }

  const enabledClass = isDark
    ? `border border-white/15 bg-coal/75 ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-2xl'}`
    : recipe === 'editorial_luxury'
      ? 'border border-black/10 bg-white'
      : 'rounded-2xl border border-black/10 bg-white';
  const contentClass = isDark ? 'grid h-full place-items-center text-xs text-paper/55' : 'grid h-full place-items-center text-xs text-ink/50';

  return (
    <div className={`${enabledClass} ${className}`} style={style} aria-label={name}>
      <div className={contentClass}>{name} ad placeholder</div>
    </div>
  );
}
