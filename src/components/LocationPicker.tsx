import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ── Presets ───────────────────────────────────────────────────────────────

export interface Preset {
  name: string;
  lng: number;
  lat: number;
}

const PRESETS: Preset[] = [
  { name: 'NYC — Central Park',  lng: -73.9712, lat: 40.7831 },
  { name: 'Paris — Eiffel Tower', lng: 2.2945,   lat: 48.8584 },
  { name: 'London — Westminster', lng: -0.1276,  lat: 51.5074 },
  { name: 'Tokyo — Shibuya',      lng: 139.7006, lat: 35.6595 },
  { name: 'Rome — Colosseum',     lng: 12.4922,  lat: 41.8902 },
  { name: 'San Francisco — Downtown', lng: -122.4194, lat: 37.7749 },
];

// ── Style ─────────────────────────────────────────────────────────────────

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
    { id: 'bg', type: 'background', paint: { 'background-color': '#d4e9c8' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

// ── Props ─────────────────────────────────────────────────────────────────

interface LocationPickerProps {
  value: [number, number];
  onChange: (lngLat: [number, number]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markerRef    = useRef<maplibregl.Marker | null>(null);
  const onChangeRef  = useRef(onChange);

  // Keep latest onChange so the click handler always calls the current one.
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const [display, setDisplay] = useState<[number, number]>(value);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let map: maplibregl.Map | null = null;

    const init = () => {
      if (map || !containerRef.current) return;
      if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: value,
        zoom: 3,
        attributionControl: false,
      });

      map.once('load', () => map!.resize());

      // Drop a marker at the current value
      markerRef.current = new maplibregl.Marker({ color: '#ef4444', draggable: true })
        .setLngLat(value)
        .addTo(map);

      markerRef.current.on('dragend', () => {
        const { lng, lat } = markerRef.current!.getLngLat();
        setDisplay([lng, lat]);
        onChangeRef.current([lng, lat]);
      });

      // Click anywhere → move marker there
      map.on('click', (e) => {
        const ll: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        markerRef.current?.setLngLat(ll);
        setDisplay(ll);
        onChangeRef.current(ll);
      });

      mapRef.current = map;
    };

    init();
    const ro = new ResizeObserver(init);
    ro.observe(el);

    return () => {
      ro.disconnect();
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // Only run once on mount — the map owns its state after init; parent updates
  // come back through presets via flyTo below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the parent changes `value` (preset click), fly to that location
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const [lng, lat] = value;
    const cur = markerRef.current.getLngLat();
    if (Math.abs(cur.lng - lng) < 1e-6 && Math.abs(cur.lat - lat) < 1e-6) return;
    markerRef.current.setLngLat(value);
    mapRef.current.flyTo({ center: value, zoom: 13, speed: 1.6 });
    setDisplay(value);
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="w-full h-64 rounded-md overflow-hidden border border-gray-200"
      />

      <div className="text-xs text-gray-600">
        <span className="font-semibold">Selected:</span>{' '}
        <span className="font-mono">{display[1].toFixed(4)}, {display[0].toFixed(4)}</span>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Quick picks:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => onChangeRef.current([p.lng, p.lat])}
              className="text-xs text-left px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-blue-400 transition"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
