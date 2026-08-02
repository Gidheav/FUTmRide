import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

interface PremiumBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoints?: string[]; // Kept for backwards compatibility but now auto-sizes
  children: React.ReactNode;
  enablePanDownToClose?: boolean;
  useScrollView?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Premium bottom-sheet built entirely on RN's built-in Modal + Animated.
 * - Auto-height based on content
 * - Faster spring physics for snappy response
 * - Keyboard avoiding view to lift content above keyboard
 */
export default function PremiumBottomSheet({
  visible,
  onClose,
  children,
  enablePanDownToClose = true,
  useScrollView = false,
}: PremiumBottomSheetProps) {
  // Start the sheet far off-screen initially
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [internalVisible, setInternalVisible] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const isClosing = useRef(false);

  // Close animation + dismiss
  const animateOut = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    const distance = contentHeight > 0 ? contentHeight : SCREEN_HEIGHT;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: distance,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInternalVisible(false);
      isClosing.current = false;
      onClose();
    });
  }, [backdropOpacity, contentHeight, onClose, translateY]);

  // Swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enablePanDownToClose,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        enablePanDownToClose && gestureState.dy > 8,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped past 100px or fast fling, dismiss
        if (gestureState.dy > 100 || gestureState.vy > 0.8) {
          animateOut();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 400,
            mass: 0.5,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // Manual, 60fps native-driven keyboard handling
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(keyboardOffset, {
          toValue: -e.endCoordinates.height,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  const combinedTranslateY = Animated.add(translateY, keyboardOffset);

  // Visibility toggle
  useEffect(() => {
    if (visible && !internalVisible) {
      setInternalVisible(true);
      setContentHeight(0); // Reset height so onLayout can re-trigger
      translateY.setValue(SCREEN_HEIGHT); // Push down offscreen
      keyboardOffset.setValue(0);
      backdropOpacity.setValue(0);
    } else if (!visible && internalVisible && !isClosing.current) {
      animateOut();
    }
  }, [visible, internalVisible, animateOut, translateY, backdropOpacity, keyboardOffset]);

  // Trigger the slide-in once the content is measured
  useEffect(() => {
    if (internalVisible && contentHeight > 0 && !isClosing.current) {
      translateY.setValue(contentHeight); // Start exactly from its true height offscreen
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 400,
          mass: 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [internalVisible, contentHeight, translateY, backdropOpacity]);

  if (!internalVisible) return null;

  const content = useScrollView ? (
    <ScrollView
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.contentContainer}>{children}</View>
  );

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={animateOut}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={animateOut} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: combinedTranslateY }] },
            contentHeight === 0 && { opacity: 0 }, // Hide until measured
          ]}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height > 0 && contentHeight === 0) {
              setContentHeight(height);
            }
          }}
        >
          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={styles.handleZone}>
            <View style={styles.handle} />
          </View>

          {content}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  handleZone: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
});
