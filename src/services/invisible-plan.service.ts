export interface InvisiblePlan {
  id: string;
  name: string;
  amount: number;
  currency: 'INR';
  totalCredits: number;
  creditsPerMinute: number;
}

export const invisiblePlans: Record<string, InvisiblePlan> = {
  invisible_starter: {
    id: 'invisible_starter',
    name: 'Starter',
    amount: 300,
    currency: 'INR',
    totalCredits: 300,
    creditsPerMinute: 5,
  },
  invisible_standard: {
    id: 'invisible_standard',
    name: 'Standard',
    amount: 600,
    currency: 'INR',
    totalCredits: 600,
    creditsPerMinute: 5,
  },
  invisible_professional: {
    id: 'invisible_professional',
    name: 'Professional',
    amount: 1200,
    currency: 'INR',
    totalCredits: 1200,
    creditsPerMinute: 5,
  },
  invisible_enterprise: {
    id: 'invisible_enterprise',
    name: 'Enterprise',
    amount: 3000,
    currency: 'INR',
    totalCredits: 3000,
    creditsPerMinute: 5,
  },
};

export const defaultInvisiblePlanId = 'invisible_starter';

export const getInvisiblePlan = (planId = defaultInvisiblePlanId): InvisiblePlan => {
  return invisiblePlans[planId] ?? invisiblePlans[defaultInvisiblePlanId]!;
};

export const listInvisiblePlans = (): InvisiblePlan[] => Object.values(invisiblePlans);
