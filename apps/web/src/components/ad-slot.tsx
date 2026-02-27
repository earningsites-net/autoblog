import { featureFlags } from '@web/lib/site';

type AdSlotProps = {
  name: string;
  className?: string;
  minHeight?: number;
};

export function AdSlot({ name, className = '', minHeight = 280 }: AdSlotProps) {
  const style = { minHeight };

  if (!featureFlags.adSlots) {
    return (
      <div
        className={`grid w-full place-items-center rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-8 text-center ${className}`}
        style={style}
        aria-label={`${name} placeholder`}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/50">Ad Slot (Disabled)</p>
          <p className="mt-2 text-sm text-ink/70">{name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-black/10 bg-white ${className}`} style={style} aria-label={name}>
      <div className="grid h-full place-items-center text-xs text-ink/50">{name} ad placeholder</div>
    </div>
  );
}
