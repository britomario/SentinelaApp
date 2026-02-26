/**
 * Root Navigator - PIN Setup ou Parent Tabs
 */

import React, {useState, useEffect} from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';

import ParentTabs from './ParentTabs';
import PinSetupScreen from '../screens/PinSetupScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingCarousel from '../screens/OnboardingCarousel';
import UsageDetailsScreen from '../screens/parents/UsageDetailsScreen';
import {isOnboardingDone, isCarouselCompleted} from '../services/onboardingState';

const Stack = createNativeStackNavigator();

export default function RootNavigator(): React.JSX.Element {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [carouselDone, setCarouselDone] = useState<boolean | null>(null);

  useEffect(() => {
    const {NativeModules} = require('react-native');
    NativeModules.SecurityModule?.hasSecurityPin?.()
      ?.then?.((v: boolean) => setHasPin(v))
      ?.catch?.(() => setHasPin(false));
    isOnboardingDone()
      .then(setOnboardingDone)
      .catch(() => setOnboardingDone(false));
    isCarouselCompleted()
      .then(setCarouselDone)
      .catch(() => setCarouselDone(false));
  }, []);

  if (hasPin === null || onboardingDone === null || carouselDone === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  let initialRouteName: 'Onboarding' | 'Welcome' | 'PinSetup' | 'Main' = 'Main';
  if (!carouselDone) {
    initialRouteName = 'Onboarding';
  } else if (!onboardingDone) {
    initialRouteName = 'Welcome';
  } else if (!hasPin) {
    initialRouteName = 'PinSetup';
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{headerShown: false}}
        initialRouteName={initialRouteName}>
        <Stack.Screen name="Onboarding" component={OnboardingCarousel} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="PinSetup" component={PinSetupScreen} />
        <Stack.Screen name="Main" component={ParentTabs} />
        <Stack.Screen name="UsageDetails" component={UsageDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1720',
  },
  loadingText: {
    color: '#9aa6b2',
    marginTop: 12,
  },
});
