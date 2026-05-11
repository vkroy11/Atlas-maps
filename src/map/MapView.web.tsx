import { useEffect, useRef } from 'react';
import { Map, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { MinimalStyleSpec } from './loadStyle';
import type { TileCoord } from '../services/storage';
import { DELHI_NCR_BOUNDS, lonLatToTile, ZOOM_RANGE } from '../utils/tileMath';

export interface MapViewProps {
  style: MinimalStyleSpec;
  onCenterChange?: (coord: TileCoord) => void;
}

const NEW_DELHI: [number, number] = [77.209, 28.6139];

export default function MapView({ style, onCenterChange }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const cbRef = useRef(onCenterChange);

  useEffect(() => {
    cbRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: style as unknown as StyleSpecification,
      center: NEW_DELHI,
      zoom: 12,
      minZoom: ZOOM_RANGE.min,
      maxZoom: ZOOM_RANGE.max,
      maxBounds: [
        [DELHI_NCR_BOUNDS.minLon, DELHI_NCR_BOUNDS.minLat],
        [DELHI_NCR_BOUNDS.maxLon, DELHI_NCR_BOUNDS.maxLat],
      ],
      attributionControl: { compact: true },
    });

    const reportCenter = () => {
      const { lng, lat } = map.getCenter();
      const z = Math.round(map.getZoom());
      const { x, y } = lonLatToTile(lng, lat, z);
      cbRef.current?.({ z, x, y });
    };
    map.on('load', reportCenter);
    map.on('moveend', reportCenter);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [style]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0f0d' }}
    />
  );
}
