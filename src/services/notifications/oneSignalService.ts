import OneSignal from 'react-native-onesignal';
import {getEnv} from '../config/env';
import {captureHandledError} from '../observability/sentry';

let initialized = false;

export async function initializeOneSignal(): Promise<boolean> {
  if (initialized) {
    return true;
  }
  const appId = getEnv('ONESIGNAL_APP_ID');
  if (!appId) {
    return false;
  }

  try {
    OneSignal.initialize(appId);
    OneSignal.Notifications.requestPermission(true);
    initialized = true;
    return true;
  } catch (error) {
    captureHandledError(error, 'onesignal_init');
    return false;
  }
}

export async function getPushSubscriptionId(): Promise<string | null> {
  try {
    if (!initialized) {
      await initializeOneSignal();
    }
    return OneSignal.User.pushSubscription.getIdAsync();
  } catch (error) {
    captureHandledError(error, 'onesignal_get_subscription');
    return null;
  }
}

/** Set child_id tag so dispatch filters reach this device (alerts/dispatch). */
export async function setChildIdTag(childId: string): Promise<boolean> {
  try {
    if (!initialized) {
      await initializeOneSignal();
    }
    OneSignal.User.addTag('child_id', childId);
    return true;
  } catch (error) {
    captureHandledError(error, 'onesignal_add_tag');
    return false;
  }
}

export async function sendGuardianAlert(payload: {
  childId: string;
  title: string;
  message: string;
}): Promise<boolean> {
  const apiBase = getEnv('SYNC_API_BASE_URL');
  if (!apiBase) {
    return false;
  }

  try {
    const response = await fetch(`${apiBase}/api/alerts/dispatch`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    captureHandledError(error, 'onesignal_dispatch_alert');
    return false;
  }
}
