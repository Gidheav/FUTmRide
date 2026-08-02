import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import {
  Canvas,
  Rect,
  SweepGradient,
  vec,
  Blur,
} from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, Easing, useDerivedValue } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export default function MeshGradient() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(2 * Math.PI, { // 360 degrees in radians
        duration: 15000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const transform = useDerivedValue(() => {
    return [{ rotate: rotation.value }];
  });

  return (
    <Canvas style={styles.canvas}>
      <Rect x={0} y={0} width={width} height={height}>
        <SweepGradient
          c={vec(width / 2, height / 2)}
          colors={['#4A0E78', '#14B8A6', '#F59E0B', '#9C4DCC', '#4A0E78']}
          transform={transform}
        />
        <Blur blur={40} />
      </Rect>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
});
