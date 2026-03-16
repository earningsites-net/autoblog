export type SubscriptionPlan = 'base' | 'standard' | 'pro';
export type BillingStatus = 'n/a' | 'trial' | 'active' | 'overdue' | 'canceled';

export const PLAN_QUOTAS: Record<SubscriptionPlan, number> = {
  base: 3,
  standard: 20,
  pro: 60
};

export function normalizePlan(value: string | undefined | null): SubscriptionPlan {
  if (value === 'standard' || value === 'pro' || value === 'base') {
    return value;
  }
  return 'base';
}

export function getQuotaForPlan(plan: SubscriptionPlan): number {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.base;
}

export function getPlanRank(plan: SubscriptionPlan): number {
  if (plan === 'pro') return 3;
  if (plan === 'standard') return 2;
  return 1;
}

export function comparePlanRank(current: SubscriptionPlan, next: SubscriptionPlan): -1 | 0 | 1 {
  const diff = getPlanRank(next) - getPlanRank(current);
  if (diff > 0) return 1;
  if (diff < 0) return -1;
  return 0;
}

export function planFromPriceId(priceId: string | undefined | null): SubscriptionPlan | null {
  if (!priceId) return null;

  const baseId = String(process.env.STRIPE_PRICE_ID_BASE || '').trim();
  const standardId = String(process.env.STRIPE_PRICE_ID_STANDARD || '').trim();
  const proId = String(process.env.STRIPE_PRICE_ID_PRO || '').trim();

  if (baseId && priceId === baseId) return 'base';
  if (standardId && priceId === standardId) return 'standard';
  if (proId && priceId === proId) return 'pro';

  return null;
}

export function priceIdForPlan(plan: SubscriptionPlan): string {
  if (plan === 'standard') return String(process.env.STRIPE_PRICE_ID_STANDARD || '').trim();
  if (plan === 'pro') return String(process.env.STRIPE_PRICE_ID_PRO || '').trim();
  return String(process.env.STRIPE_PRICE_ID_BASE || '').trim();
}

export function getCurrentMonthWindow(reference = new Date()) {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return {
    periodStartIso: periodStart.toISOString(),
    periodEndIso: periodEnd.toISOString()
  };
}

export function isIsoBefore(valueA: string, valueB: string) {
  return new Date(valueA).getTime() < new Date(valueB).getTime();
}
