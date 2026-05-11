export const PLANS = {
  free: {
    name: 'free',
    stripePriceId: null,
    assistantLimit: 0,
    monthlyPrice: 0,
  },
  starter: {
    name: 'starter',
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID ?? '',
    assistantLimit: 1,
    monthlyPrice: 2900,
  },
  growth: {
    name: 'growth',
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID ?? '',
    assistantLimit: 5,
    monthlyPrice: 7900,
  },
  pro: {
    name: 'pro',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    assistantLimit: 999,
    monthlyPrice: 19900,
  },
} as const;

export type PlanName = keyof typeof PLANS;

export function getPlanByPriceId(priceId: string): (typeof PLANS)[PlanName] {
  const plan = Object.values(PLANS).find((p) => p.stripePriceId === priceId);
  if (!plan) throw new Error(`Unknown price ID: ${priceId}`);
  return plan;
}
