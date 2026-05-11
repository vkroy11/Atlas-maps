import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorOverlay, LoadingOverlay } from '../components';
import { useMapSetup, usePrefetch } from '../hooks';
import MapView from '../map/MapView';
import { DEFAULT_PREFETCH_SETTINGS, loadPrefetchSettings } from '../services/prefetch';
import type { PrefetchSettings } from '../services/prefetch';
import type { TileCoord } from '../services/storage';

export default function MapScreen() {
  const setup = useMapSetup();
  const [center, setCenter] = useState<TileCoord | null>(null);
  const [prefetch, setPrefetch] = useState<PrefetchSettings>(DEFAULT_PREFETCH_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    loadPrefetchSettings().then((s) => {
      if (!cancelled) setPrefetch(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  usePrefetch(setup.status === 'ready' ? setup.storage : null, center, prefetch);

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
          <MapView style={setup.style} onCenterChange={setCenter} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0d' },
  mapWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
});
