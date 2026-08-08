import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import type { ToastType } from '../context/ToastContext';

interface ToastProps {
  visible: boolean;
  message: string;
  type: ToastType;
  onHide: () => void;
}

const Toast: React.FC<ToastProps> = ({ visible, message, type, onHide }) => {
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: insets.top + 16,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, insets.top]);

  if (!visible && opacity._value === 0) return null;

  let iconName = 'info';
  let iconColor = COLORS.onSurface;
  let bgColor = COLORS.surfaceContainerHigh;

  if (type === 'error') {
    iconName = 'error';
    iconColor = COLORS.onError;
    bgColor = COLORS.error;
  } else if (type === 'success') {
    iconName = 'check-circle';
    iconColor = '#fff';
    bgColor = '#2E7D32'; // Green
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={0.9} onPress={onHide} style={[styles.toastContent, { backgroundColor: bgColor }]}>
        <MaterialIcons name={iconName as any} size={20} color={iconColor} style={styles.icon} />
        <Text style={[styles.message, { color: iconColor }]}>{message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    maxWidth: '90%',
    ...AMBIENT_SHADOW,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    ...FONTS.bodyMd,
    fontWeight: '500',
    flexShrink: 1,
  },
});

export default Toast;
