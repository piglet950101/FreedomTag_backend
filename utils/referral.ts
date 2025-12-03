export function generateReferralCode(type: 'PHILANTHROPIST' | 'TAG' | 'MERCHANT' | 'ORGANIZATION', id: string): string {
  const prefix = {
    PHILANTHROPIST: 'PHIL',
    TAG: 'TAG',
    MERCHANT: 'MERC',
    ORGANIZATION: 'ORG'
  }[type];
  
  // Generate a random 6-character alphanumeric code
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return `${prefix}${randomPart}`;
}

export function calculateReferralReward(referrerType: string, referredType: string): number {
  // Reward structure in ZAR cents
  // When philanthropist refers philanthropist: R 50
  // When philanthropist refers tag: R 20
  // When tag refers philanthropist: R 30
  // When tag refers tag: R 10
  // Default: R 10
  
  const rewards: Record<string, Record<string, number>> = {
    PHILANTHROPIST: {
      PHILANTHROPIST: 5000,  // R 50
      TAG: 2000,             // R 20
      MERCHANT: 3000,        // R 30
      ORGANIZATION: 5000,    // R 50
    },
    TAG: {
      PHILANTHROPIST: 3000,  // R 30
      TAG: 1000,             // R 10
      MERCHANT: 2000,        // R 20
      ORGANIZATION: 2000,    // R 20
    },
    MERCHANT: {
      PHILANTHROPIST: 5000,  // R 50
      TAG: 2000,             // R 20
      MERCHANT: 3000,        // R 30
      ORGANIZATION: 3000,    // R 30
    },
    ORGANIZATION: {
      PHILANTHROPIST: 5000,  // R 50
      TAG: 2000,             // R 20
      MERCHANT: 3000,        // R 30
      ORGANIZATION: 5000,    // R 50
    },
  };
  
  return rewards[referrerType]?.[referredType] ?? 1000; // Default R 10
}
