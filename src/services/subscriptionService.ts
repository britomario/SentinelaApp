import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCustomerInfoSafe,
  initializeRevenueCat,
  purchasePackageByIdentifier,
} from './revenuecatService';

const TRIAL_KEY = 'sentinela.premium.trialStart';
const LICENSE_KEY = 'sentinela.premium.annual.active';
const TRIAL_DAYS = 7;

export type PremiumStatus =
  | 'trial_available'
  | 'trial_active'
  | 'grace_period'
  | 'expired'
  | 'premium_active';

export type PremiumState = {
  status: PremiumStatus;
  trialStartedAt: number | null;
  trialDaysLeft: number;
  trialActive: boolean;
  annualActive: boolean;
};

export async function getPremiumState(): Promise<PremiumState> {
  const info = await getCustomerInfoSafe();
  const [trialValue, annualValue] = await AsyncStorage.multiGet([
    TRIAL_KEY,
    LICENSE_KEY,
  ]);
  const trialStartedAt = trialValue[1] ? Number(trialValue[1]) : null;
  const legacyAnnual = annualValue[1] === '1';

  const activeEntitlements = info?.entitlements?.active ?? {};
  const hasEntitlement = Object.keys(activeEntitlements).length > 0;
  const anyEntitlement = Object.values(activeEntitlements)[0];
  const isInGracePeriod =
    anyEntitlement &&
    typeof anyEntitlement === 'object' &&
    'periodType' in anyEntitlement &&
    (anyEntitlement as {periodType?: string}).periodType === 'GRACE';

  if (hasEntitlement) {
    await AsyncStorage.setItem(LICENSE_KEY, '1');
    return {
      status: isInGracePeriod ? 'grace_period' : 'premium_active',
      trialStartedAt,
      trialDaysLeft: 0,
      trialActive: false,
      annualActive: true,
    };
  }

  const trialDaysLeft = resolveTrialDaysLeft(trialStartedAt);
  const trialActive = trialDaysLeft > 0;

  if (trialActive) {
    return {
      status: 'trial_active',
      trialStartedAt,
      trialDaysLeft,
      trialActive: true,
      annualActive: false,
    };
  }

  if (trialStartedAt || legacyAnnual) {
    return {
      status: 'expired',
      trialStartedAt,
      trialDaysLeft: 0,
      trialActive: false,
      annualActive: false,
    };
  }

  return {
    status: 'trial_available',
    trialStartedAt: null,
    trialDaysLeft: TRIAL_DAYS,
    trialActive: false,
    annualActive: false,
  };
}

export async function startTrial(): Promise<PremiumState> {
  const now = Date.now();
  await AsyncStorage.setItem(TRIAL_KEY, String(now));
  return getPremiumState();
}

export async function activateAnnualLicense(): Promise<PremiumState> {
  const initialized = await initializeRevenueCat();
  if (!initialized) {
    return getPremiumState();
  }
  const purchaseOk = await purchasePackageByIdentifier('$rc_annual');
  if (!purchaseOk) {
    return getPremiumState();
  }
  await AsyncStorage.setItem(LICENSE_KEY, '1');
  return getPremiumState();
}

function resolveTrialDaysLeft(trialStartedAt: number | null): number {
  if (!trialStartedAt) {
    return TRIAL_DAYS;
  }
  const elapsedMs = Date.now() - trialStartedAt;
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, TRIAL_DAYS - elapsedDays);
}
