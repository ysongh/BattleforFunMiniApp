import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ── Public handle ─────────────────────────────────────────────────────────

export interface MapLibreBackdropHandle {
  setCamera: (bearing: number, pitch: number, zoom: number) => void;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface MapLibreBackdropProps {
  /** Geographic centre of the game grid [lng, lat]. */
  center?: [number, number];
  /** Initial map zoom level. 15 = street-level detail. */
  zoom?: number;
}

// ── Style spec ────────────────────────────────────────────────────────────

// Plain raster OSM style with an explicit background layer so MapLibre
// shows a solid colour immediately while tiles are still fetching.
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    // Solid background so the canvas is never transparent
    { id: 'bg', type: 'background', paint: { 'background-color': '#d4e9c8' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────

const MapLibreBackdrop = forwardRef<MapLibreBackdropHandle, MapLibreBackdropProps>(
  ({ center = [-73.9712, 40.7831], zoom = 15 }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<maplibregl.Map | null>(null);

    useImperativeHandle(ref, () => ({
      setCamera(bearing: number, pitch: number, zoom: number) {
        mapRef.current?.jumpTo({ bearing, pitch, zoom });
      },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      // MapLibre reads the container's clientWidth/clientHeight at init time.
      // With CSS-based sizing (absolute inset-0) these can be 0 if layout
      // hasn't resolved yet.  Use a ResizeObserver to init only once real
      // dimensions are available.
      let map: maplibregl.Map | null = null;

      const init = () => {
        if (map || !containerRef.current) return;
        if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;

        map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center,
          zoom,
          bearing: 0,
          pitch: 45,
          interactive: false,
          attributionControl: false,
        });

        map.on('error', (e) => console.error('[MapLibreBackdrop]', e.error));
        map.once('load', () => map!.resize());
        mapRef.current = map;
      };

      // Attempt immediately (works if layout is already done)
      init();

      // Fall back: watch for first non-zero resize in case layout resolves later
      const ro = new ResizeObserver(init);
      ro.observe(el);

      return () => {
        ro.disconnect();
        map?.remove();
        mapRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
        }}
      />
    );
  },
);

MapLibreBackdrop.displayName = 'MapLibreBackdrop';
export default MapLibreBackdrop;
