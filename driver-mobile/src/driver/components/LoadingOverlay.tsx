import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text, Easing } from 'react-native';
import { COLORS } from '../../core/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  inline?: boolean;
  size?: number;
}

export default function LoadingOverlay({ visible, message, inline = false, size = 60 }: LoadingOverlayProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Continuous 360 rotation
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Gentle pulse for the inner logo
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      rotation.setValue(0);
      pulse.setValue(1);
    }
  }, [visible, rotation, pulse]);

  if (!visible) return null;

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinReverse = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <View style={inline ? styles.inlineOverlay : styles.overlay}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        
        {/* Outer Ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: Math.max(3, size * 0.05),
              borderColor: COLORS.primary + '20', // transparent track
              borderTopColor: COLORS.primary, // solid spinner
              transform: [{ rotate: spin }],
            },
          ]}
        />

        {/* Inner Ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              width: size * 0.75,
              height: size * 0.75,
              borderRadius: (size * 0.75) / 2,
              borderWidth: Math.max(3, size * 0.04),
              borderColor: 'transparent',
              borderLeftColor: COLORS.secondary,
              borderBottomColor: COLORS.secondary,
              transform: [{ rotate: spinReverse }],
            },
          ]}
        />

        {/* Center Logo */}
        <Animated.Image
          source={require('../../../assets/FUT-icon-removedbg.png')}
          style={[
            {
              position: 'absolute',
              width: size * 0.45,
              height: size * 0.45,
              transform: [{ scale: pulse }],
            },
          ]}
          resizeMode="contain"
        />
      </View>
      
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
  ring: {
    position: 'absolute',
  },
  messageText: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
});
