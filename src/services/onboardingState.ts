import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_DONE_KEY = 'sentinela.onboarding.done';
const CAROUSEL_DONE_KEY = 'sentinela.onboarding.carousel_done';
const LINKED_PROVIDER_KEY = 'sentinela.onboarding.linkedProvider';
const TOUR_PREFIX = 'sentinela.tour.';

export type LinkedProvider = 'google' | 'apple' | 'manual';

export async function isCarouselCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(CAROUSEL_DONE_KEY);
  return value === '1';
}

export async function markCarouselCompleted(): Promise<void> {
  await AsyncStorage.setItem(CAROUSEL_DONE_KEY, '1');
}

export async function isOnboardingDone(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  return value === '1';
}

export async function completeOnboarding(provider: LinkedProvider): Promise<void> {
  await AsyncStorage.multiSet([
    [ONBOARDING_DONE_KEY, '1'],
    [LINKED_PROVIDER_KEY, provider],
  ]);
}

export async function getLinkedProvider(): Promise<LinkedProvider | null> {
  const provider = await AsyncStorage.getItem(LINKED_PROVIDER_KEY);
  if (provider === 'google' || provider === 'apple' || provider === 'manual') {
    return provider;
  }
  return null;
}

export async function hasSeenTour(featureKey: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(`${TOUR_PREFIX}${featureKey}`);
  return value === '1';
}

export async function markTourSeen(featureKey: string): Promise<void> {
  await AsyncStorage.setItem(`${TOUR_PREFIX}${featureKey}`, '1');
}
