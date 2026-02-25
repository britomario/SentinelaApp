/**
 * Modo Descanso - brilho, filtro azul, bloqueio de apps, automação por nascer/pôr do sol.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules, Platform} from 'react-native';
import SunCalc from 'suncalc';

const {DisplayWellnessModule, AppBlockModule} = NativeModules;
const REST_MODE_KEY = '@sentinela/rest_mode_active';
const REST_MODE_AUTO_KEY = '@sentinela/rest_mode_auto';
const REST_MODE_COORDS_KEY = '@sentinela/rest_mode_coords';

export type RestModeCoords = { lat: number; lng: number } | null;

export async function isRestModeActive(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(REST_MODE_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setRestModeActive(active: boolean): Promise<void> {
  await AsyncStorage.setItem(REST_MODE_KEY, String(active));
  if (Platform.OS === 'android' && AppBlockModule?.setRestModeActive) {
    try {
      await AppBlockModule.setRestModeActive(active);
    } catch {
      // Silently fail - AccessibilityService may not be running
    }
  }
}

export async function getRestModeAuto(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(REST_MODE_AUTO_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setRestModeAuto(auto: boolean): Promise<void> {
  await AsyncStorage.setItem(REST_MODE_AUTO_KEY, String(auto));
}

export async function getRestModeCoords(): Promise<RestModeCoords> {
  try {
    const raw = await AsyncStorage.getItem(REST_MODE_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number };
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return parsed;
    }
  } catch {}
  return null;
}

export async function setRestModeCoords(coords: RestModeCoords): Promise<void> {
  if (coords) {
    await AsyncStorage.setItem(REST_MODE_COORDS_KEY, JSON.stringify(coords));
  } else {
    await AsyncStorage.removeItem(REST_MODE_COORDS_KEY);
  }
}

export function getSunsetSunriseToday(coords: { lat: number; lng: number }): { sunset: Date; sunrise: Date } {
  const times = SunCalc.getTimes(new Date(), coords.lat, coords.lng);
  return {
    sunset: times.sunset,
    sunrise: times.sunrise,
  };
}

export async function applyRestModeDisplay(active: boolean): Promise<void> {
  if (Platform.OS !== 'android' || !DisplayWellnessModule) return;
  try {
    if (active) {
      await DisplayWellnessModule.setBrightness(0.2);
      await DisplayWellnessModule.setBlueLightFilter?.(true);
      await DisplayWellnessModule.setBlueLightOverlay?.(true);
    } else {
      await DisplayWellnessModule.setBrightness(0.8);
      await DisplayWellnessModule.setBlueLightFilter?.(false);
      await DisplayWellnessModule.setBlueLightOverlay?.(false);
    }
  } catch {
    // Silently fail - permissions or unsupported device
  }
}

export async function requestDisplayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !DisplayWellnessModule) return false;
  try {
    const canWrite = await DisplayWellnessModule.canWriteSettings();
    if (!canWrite) {
      await DisplayWellnessModule.requestWriteSettingsPermission();
      return false;
    }
    const canOverlay = await DisplayWellnessModule.canDrawOverlay?.();
    if (canOverlay === false) {
      await DisplayWellnessModule.requestOverlayPermission?.();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
