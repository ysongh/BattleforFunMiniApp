import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Tile, TerrainType } from '../types/game';

// ── Coordinate mapping ────────────────────────────────────────────────────
// Each grid cell occupies TILE_DEG × TILE_DEG degrees of fake lat/lng space.
// Row 0 is mapped to the northernmost latitude (highest lat value) so the
// minimap orientation matches the 3D board's "top = row 0" convention.

const TILE_DEG = 0.01;
const HALF = TILE_DEG / 2;

function gridToLngLat(x: number, y: number): [number, number] {
  return [x * TILE_DEG, (9 - y) * TILE_DEG];
}

// ── Terrain palette (matches GameBoard3D) ─────────────────────────────────

const TERRAIN_FILL: Record<TerrainType, string> = {
  Plain:    '#86efac',
  Road:     '#d97706',
  Forest:   '#15803d',
  Mountain: '#6b7280',
  City:     '#fde68a',
  Water:    '#3b82f6',
};

// ── GeoJSON builders ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTileCollection(grid: Tile[][]): any {
  const features = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
      const tile = grid[y][x];
      const [cx, cy] = gridToLngLat(x, y);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [cx - HALF, cy - HALF],
            [cx + HALF, cy - HALF],
            [cx + HALF, cy + HALF],
            [cx - HALF, cy + HALF],
            [cx - HALF, cy - HALF],
          ]],
        },
        properties: { color: TERRAIN_FILL[tile.terrain.type] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUnitCollection(grid: Tile[][]): any {
  const features = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
      const unit = grid[y][x]?.unit;
      if (!unit) continue;
      const [cx, cy] = gridToLngLat(x, y);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cx, cy] },
        properties: {
          color: unit.player === 'Red' ? '#ef4444' : '#3b82f6',
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function pushData(map: maplibregl.Map, grid: Tile[][]) {
  (map.getSource('tiles') as maplibregl.GeoJSONSource).setData(buildTileCollection(grid));
  (map.getSource('units') as maplibregl.GeoJSONSource).setData(buildUnitCollection(grid));
}

// ── Component ─────────────────────────────────────────────────────────────

interface MinimapOverlayProps {
  grid: Tile[][];
}

export default function MinimapOverlay({ grid }: MinimapOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const loadedRef    = useRef(false);
  const latestGrid   = useRef(grid);

  // Keep a ref to the latest grid so the 'load' callback always sees current data.
  useEffect(() => { latestGrid.current = grid; }, [grid]);

  // Initialise the MapLibre map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Minimal offline style — no external tile servers required.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style: {
        version: 8,
        sources: {},
        layers: [{
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#0f172a' },
        }],
      } as maplibregl.StyleSpecification,
      // Fit all 10×10 tiles with a small margin.
      bounds: [
        [-HALF,                 -HALF                ],
        [9 * TILE_DEG + HALF,   9 * TILE_DEG + HALF  ],
      ],
      fitBoundsOptions: { padding: 4, animate: false },
      interactive: false,
      attributionControl: false,
    });

    map.on('load', () => {
      // Terrain tile polygons
      map.addSource('tiles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'tiles-fill',
        type: 'fill',
        source: 'tiles',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.92 },
      });
      map.addLayer({
        id: 'tiles-outline',
        type: 'line',
        source: 'tiles',
        paint: { 'line-color': '#00000040', 'line-width': 0.5 },
      });

      // Unit dots
      map.addSource('units', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'units-circle',
        type: 'circle',
        source: 'units',
        paint: {
          'circle-radius': 4,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      loadedRef.current = true;

      // Hydrate immediately if grid is already available.
      if (latestGrid.current.length > 0) {
        pushData(map, latestGrid.current);
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Sync unit positions whenever game state changes.
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current || grid.length === 0) return;
    pushData(mapRef.current, grid);
  }, [grid]);

  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-lg overflow-hidden shadow-xl border-2 border-white/30">
      {/* MapLibre canvas */}
      <div ref={containerRef} style={{ width: 144, height: 144 }} />
      {/* Label */}
      <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded select-none pointer-events-none">
        MINIMAP
      </span>
    </div>
  );
}
