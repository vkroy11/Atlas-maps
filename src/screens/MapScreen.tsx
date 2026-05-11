import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorOverlay, LoadingOverlay } from '../components';
import { useMapSetup } from '../hooks';
import MapView from '../map/MapView';

export default function MapScreen() {
  const setup = useMapSetup();

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      {setup.status === 'loading' && (
        <LoadingOverlay title="Atlas Offline" subtitle="Loading Delhi NCR…" />
      )}
      {setup.status === 'error' && (
        <ErrorOverlay
          title="Map failed to load"
          subtitle="Check MAPTILER_KEY and network"
          error={setup.error}
        />
      )}
      {setup.status === 'ready' && (
        <View style={styles.mapWrapper}>
          <MapView style={setup.style} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0d' },
  mapWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
});
