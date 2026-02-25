import {Platform} from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
} from 'react-native-purchases';
import {getEnv} from './config/env';
import {captureHandledError} from './observability/sentry';

let configured = false;

export async function initializeRevenueCat(appUserId?: string): Promise<boolean> {
  if (configured) {
    return true;
  }
  const apiKey =
    Platform.OS === 'ios'
      ? getEnv('REVENUECAT_IOS_API_KEY')
      : getEnv('REVENUECAT_ANDROID_API_KEY');
  if (!apiKey) {
    return false;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({apiKey, appUserID: appUserId});
    configured = true;
    return true;
  } catch (error) {
    captureHandledError(error, 'revenuecat_init');
    return false;
  }
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  try {
    if (!configured) {
      await initializeRevenueCat();
    }
    return await Purchases.getCustomerInfo();
  } catch (error) {
    captureHandledError(error, 'revenuecat_customer_info');
    return null;
  }
}

export async function getCurrentOfferingSafe(): Promise<PurchasesOffering | null> {
  try {
    if (!configured) {
      await initializeRevenueCat();
    }
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    captureHandledError(error, 'revenuecat_offerings');
    return null;
  }
}

export async function purchasePackageByIdentifier(
  packageIdentifier: '$rc_annual' | '$rc_monthly' | '$rc_lifetime',
): Promise<boolean> {
  const offering = await getCurrentOfferingSafe();
  if (!offering) {
    return false;
  }

  const pkg = offering.availablePackages.find(
    candidate => candidate.identifier === packageIdentifier,
  );
  if (!pkg) {
    return false;
  }

  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (error) {
    captureHandledError(error, 'revenuecat_purchase');
    return false;
  }
}
