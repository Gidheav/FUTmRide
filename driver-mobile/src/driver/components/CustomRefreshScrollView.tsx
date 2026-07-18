import React from 'react';
import { ScrollView, ScrollViewProps, RefreshControl, View } from 'react-native';
import LoadingOverlay from './LoadingOverlay';

interface Props extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export default function CustomRefreshScrollView({ refreshing, onRefresh, children, ...props }: Props) {
  return (
    <View style={[{ flex: 1 }, props.style, { backgroundColor: 'transparent' }]}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, justifyContent: 'center', alignItems: 'center', zIndex: -1 }}>
        <LoadingOverlay visible={refreshing} inline size={50} />
      </View>
      <ScrollView
        {...props}
        style={[{ flex: 1, backgroundColor: 'transparent' }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
