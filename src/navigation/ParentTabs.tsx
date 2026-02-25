/**
 * Tab Navigator para Pais - Dashboard, Apps, Config, Modo Criança
 * Ícones Lucide com labels curtas (evita truncamento)
 */

import React from 'react';
import {StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  Home,
  LayoutGrid,
  Settings,
  Star,
  Link2,
  Users,
  Lock,
  Moon,
} from 'lucide-react-native';

import DashboardScreen from '../screens/parents/DashboardScreen';
import AppsControlScreen from '../screens/parents/AppsControlScreen';
import ChildModeScreen from '../screens/child/ChildModeScreen';
import ChildRestrictedScreen from '../screens/child/ChildRestrictedScreen';
import PremiumScreen from '../screens/PremiumScreen';
import PairingScreen from '../screens/parents/PairingScreen';
import ConfigScreen from '../screens/parents/ConfigScreen';
import RestModeScreen from '../screens/RestModeScreen';

const Tab = createBottomTabNavigator();

function makeTabIcon(Icon: React.ElementType) {
  return function TabIconComponent(props: {focused?: boolean; color: string; size?: number}) {
    return (
      <View style={styles.iconWrap}>
        <Icon color={props.color} size={props.size ?? 22} />
      </View>
    );
  };
}

export default function ParentTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarScrollEnabled: true,
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          allowFontScaling: false,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          width: 90,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          paddingTop: 8,
          height: 60,
          borderRadius: 24,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -2},
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{tabBarLabel: 'Início', tabBarIcon: makeTabIcon(Home)}}
      />
      <Tab.Screen
        name="Apps"
        component={AppsControlScreen}
        options={{tabBarLabel: 'Apps', tabBarIcon: makeTabIcon(LayoutGrid)}}
      />
      <Tab.Screen
        name="Config"
        component={ConfigScreen}
        options={{tabBarLabel: 'Ajustes', tabBarIcon: makeTabIcon(Settings)}}
      />
      <Tab.Screen
        name="Premium"
        component={PremiumScreen}
        options={{tabBarLabel: 'Premium', tabBarIcon: makeTabIcon(Star)}}
      />
      <Tab.Screen
        name="Parear"
        component={PairingScreen}
        options={{tabBarLabel: 'Parear', tabBarIcon: makeTabIcon(Link2)}}
      />
      <Tab.Screen
        name="ChildMode"
        component={ChildModeScreen}
        options={{tabBarLabel: 'Espaço', tabBarIcon: makeTabIcon(Users)}}
      />
      <Tab.Screen
        name="RestMode"
        component={RestModeScreen}
        options={{tabBarLabel: 'Dormir', tabBarIcon: makeTabIcon(Moon)}}
      />
      <Tab.Screen
        name="ChildLock"
        component={ChildRestrictedScreen}
        options={{tabBarLabel: 'Restrito', tabBarIcon: makeTabIcon(Lock)}}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {alignItems: 'center', justifyContent: 'center'},
});
