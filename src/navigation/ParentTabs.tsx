/**
 * Tab Navigator para Pais - Dashboard, Apps, Config, Modo Criança
 */

import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import DashboardScreen from '../screens/parents/DashboardScreen';
import AppsControlScreen from '../screens/parents/AppsControlScreen';
import ChildModeScreen from '../screens/child/ChildModeScreen';
import ChildRestrictedScreen from '../screens/child/ChildRestrictedScreen';
import PremiumScreen from '../screens/PremiumScreen';
import PairingScreen from '../screens/parents/PairingScreen';

// Bloco de configuracoes de escudo, DNS e apps monitorados.
import ConfigScreen from '../screens/parents/ConfigScreen';

const Tab = createBottomTabNavigator();

type TabIconProps = {emoji: string; color: string};

function TabIcon({emoji, color}: Readonly<TabIconProps>): React.JSX.Element {
  return <Text style={[styles.tabIcon, {color}]}>{emoji}</Text>;
}

function makeTabIcon(emoji: string): React.ComponentType<{color: string}> {
  return function StableTabIcon(props: {color: string}) {
    return <TabIcon emoji={emoji} color={props.color} />;
  };
}

const IconHome = makeTabIcon('🏠');
const IconApps = makeTabIcon('📱');
const IconConfig = makeTabIcon('⚙️');
const IconPremium = makeTabIcon('⭐');
const IconParear = makeTabIcon('🔗');
const IconChild = makeTabIcon('👧');
const IconLock = makeTabIcon('🔐');

export default function ParentTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          paddingTop: 8,
          height: 60,
        },
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{tabBarLabel: 'Início', tabBarIcon: IconHome}}
      />
      <Tab.Screen
        name="Apps"
        component={AppsControlScreen}
        options={{tabBarLabel: 'Apps', tabBarIcon: IconApps}}
      />
      <Tab.Screen
        name="Config"
        component={ConfigScreen}
        options={{tabBarLabel: 'Config', tabBarIcon: IconConfig}}
      />
      <Tab.Screen
        name="Premium"
        component={PremiumScreen}
        options={{tabBarLabel: 'Premium', tabBarIcon: IconPremium}}
      />
      <Tab.Screen
        name="Parear"
        component={PairingScreen}
        options={{tabBarLabel: 'Parear', tabBarIcon: IconParear}}
      />
      <Tab.Screen
        name="ChildMode"
        component={ChildModeScreen}
        options={{tabBarLabel: 'Modo Criança', tabBarIcon: IconChild}}
      />
      <Tab.Screen
        name="ChildLock"
        component={ChildRestrictedScreen}
        options={{tabBarLabel: 'Restrito', tabBarIcon: IconLock}}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {fontSize: 22},
});
