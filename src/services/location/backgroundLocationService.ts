import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {PermissionsAndroid, Platform} from 'react-native';
import {publishChildLocation} from '../realtime/socketService';
import {captureHandledError} from '../observability/sentry';

const LAST_LOCATION_TS_KEY = 'sentinela.location.lastTimestamp';
const LAST_LOCATION_PAYLOAD_KEY = 'sentinela.location.lastPayload';
let watchId: number | null = null;

export async function startBackgroundLocationTracking(
  childId: string,
): Promise<boolean> {
  const granted = await ensureLocationPermission();
  if (!granted) {
    return false;
  }

  if (watchId !== null) {
    return true;
  }

  watchId = Geolocation.watchPosition(
    async position => {
      const payload = {
        childId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(LAST_LOCATION_TS_KEY, String(payload.timestamp));
      await AsyncStorage.setItem(LAST_LOCATION_PAYLOAD_KEY, JSON.stringify(payload));
      await publishChildLocation(payload);
    },
    error => {
      captureHandledError(error, 'location_watch_error');
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 20,
      interval: 10000,
      fastestInterval: 5000,
      useSignificantChanges: false,
    },
  );

  return true;
}

export function stopBackgroundLocationTracking(): void {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export async function getLastLocationTimestamp(): Promise<number | null> {
  const value = await AsyncStorage.getItem(LAST_LOCATION_TS_KEY);
  return value ? Number(value) : null;
}

export async function getLastLocationSnapshot(): Promise<{
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_LOCATION_PAYLOAD_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      timestamp?: number;
    };
    if (
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number' &&
      typeof parsed.timestamp === 'number'
    ) {
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracy: parsed.accuracy,
        timestamp: parsed.timestamp,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  const background = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
  );
  return (
    fine === PermissionsAndroid.RESULTS.GRANTED &&
    background === PermissionsAndroid.RESULTS.GRANTED
  );
}
