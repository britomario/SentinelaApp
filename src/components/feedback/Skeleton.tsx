import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export default function Skeleton({
  width = '100%',
  height = 14,
  radius = 10,
  style,
}: SkeletonProps): React.JSX.Element {
  return <View style={[styles.base, {width, height, borderRadius: radius}, style]} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#E2E8F0',
  },
});
