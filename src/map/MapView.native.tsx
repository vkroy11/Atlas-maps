import { Camera, Map } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import type { MinimalStyleSpec } from './loadStyle';
import type { TileCoord } from '../services/storage';
import { DELHI_NCR_BOUNDS, lonLatToTile, ZOOM_RANGE } from '../utils/tileMath';

export interface MapViewProps {
  style: MinimalStyleSpec;
  onCenterChange?: (coord: TileCoord) => void;
}

const NEW_DELHI: [number, number] = [77.209, 28.6139];

export default function MapView({ style, onCenterChange }: MapViewProps) {
  const mapStyle = JSON.stringify(style);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={mapStyle}
        onRegionDidChange={(event) => {
          if (!onCenterChange) return;
          const { center, zoom } = event.nativeEvent;
          if (!center || typeof zoom !== 'number') return;
          const z = Math.round(zoom);
          const { x, y } = lonLatToTile(center[0], center[1], z);
          onCenterChange({ z, x, y });
        }}
      >
        <Camera
          initialViewState={{ center: NEW_DELHI, zoom: 12 }}
          minZoom={ZOOM_RANGE.min}
          maxZoom={ZOOM_RANGE.max}
          maxBounds={[
            DELHI_NCR_BOUNDS.minLon,
            DELHI_NCR_BOUNDS.minLat,
            DELHI_NCR_BOUNDS.maxLon,
            DELHI_NCR_BOUNDS.maxLat,
          ]}
        />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0d' },
  map: { flex: 1 },
});
