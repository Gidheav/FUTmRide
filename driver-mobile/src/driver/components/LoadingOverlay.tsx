import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  inline?: boolean;
  size?: number;
}

export default function LoadingOverlay({ visible, message, inline = false, size = 90 }: LoadingOverlayProps) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.15,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.9,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.4,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0.4);
    }
  }, [visible, scale, opacity]);

  if (!visible) return null;

  return (
    <View style={inline ? styles.inlineOverlay : styles.overlay}>
      <Animated.Image
        source={require('../../../assets/FUT-icon-removedbg.png')}
        style={[
          {
            width: size,
            height: size,
            transform: [{ scale }],
            opacity,
          },
        ]}
        resizeMode="contain"
      />
      {message ? (
        <Text style={styles.messageText}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  inlineOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  messageText: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '600',
    color: '#6A1B9A',
    textAlign: 'center',
  },
});
