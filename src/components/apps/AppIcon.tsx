/**
 * Ícone resiliente de app com fallback e cache.
 */

import React, {useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {
  getAppIconFallback,
  getAppIconUrl,
} from '../../assets/appIconCatalog';

type AppIconProps = {
  name: string;
  size?: number;
  style?: object;
};

export default function AppIcon({
  name,
  size = 40,
  style,
}: AppIconProps): React.JSX.Element {
  const [error, setError] = useState(false);
  const url = getAppIconUrl(name);
  const fallback = getAppIconFallback(name);

  if (!url || error) {
    return (
      <View
        style={[
          styles.fallback,
          {width: size, height: size, borderRadius: size / 4},
          style,
        ]}>
        <Text style={[styles.fallbackText, {fontSize: size * 0.45}]}>
          {fallback}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{uri: url}}
      style={[
        styles.image,
        {width: size, height: size, borderRadius: size / 4},
        style,
      ]}
      onError={() => setError(true)}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#F3F4F6',
  },
  fallback: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {},
});
