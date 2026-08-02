import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedCounterProps {
  value: number;
  style?: TextStyle;
  prefix?: string;
}

export default function AnimatedCounter({ value, style, prefix = '₦' }: AnimatedCounterProps) {
  // A simple animated counter using Reanimated
  // Since we can't easily animate text content directly without custom native components,
  // we animate a shared value and update a state via JS callback for simple values,
  // or we can just use a standard interval for the premium feel if we want it to be perfectly smooth.
  
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration: 1200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    
    // Fallback: simple JS interval to update the display value smoothly
    let start = displayValue;
    const end = value;
    const duration = 1200;
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * easeProgress;
      setDisplayValue(current);
      
      if (progress >= 1) {
        clearInterval(interval);
        setDisplayValue(end);
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [value]);

  const formattedValue = displayValue.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.text, style]}>
        {prefix}{formattedValue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  text: {
    fontVariant: ['tabular-nums'],
  },
});
