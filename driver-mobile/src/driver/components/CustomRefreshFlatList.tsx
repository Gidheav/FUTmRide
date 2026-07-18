import React from 'react';
import { FlatList, FlatListProps, RefreshControl, View } from 'react-native';
import LoadingOverlay from './LoadingOverlay';

interface Props<T> extends FlatListProps<T> {
  refreshing: boolean;
  onRefresh: () => void;
}

export default function CustomRefreshFlatList<T>({ refreshing, onRefresh, ...props }: Props<T>) {
  return (
    <View style={[{ flex: 1 }, props.style, { backgroundColor: 'transparent' }]}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, justifyContent: 'center', alignItems: 'center', zIndex: -1 }}>
        <LoadingOverlay visible={refreshing} inline size={50} />
      </View>
      <FlatList
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
      />
    </View>
  );
}
