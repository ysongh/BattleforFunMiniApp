/**
 * realMap.ts
 *
 * Fetches real-world terrain data from the Overpass API (OpenStreetMap) and
 * converts it into a TerrainType[][] grid that generateInitialGrid() can consume.
 *
 * Each grid cell is 100 × 100 m by default.  The classification priority is:
 *   water  →  Water     (very high movement cost — rivers/lakes/ocean)
 *   road   →  Road      (cheap movement — streets, avenues)
 *   park   →  Forest    (moderate cost — parks, woods, grass)
 *   city   →  City      (moderate cost — commercial/retail zones)
 *   plain  →  Plain     (default — residential / uncategorised urban)
 */

import type { TerrainType } from '../types/game';
import { GRID_SIZE } from './constants';

// ── Constants ─────────────────────────────────────────────────────────────

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

// ── OSM types ─────────────────────────────────────────────────────────────

interface OsmNode { lat: number; lon: number }

interface OsmElement {
  type: string;
  tags?: Record<string, string>;
  geometry?: OsmNode[];
}

type FeatureClass = 'water' | 'road' | 'park' | 'city' | 'plain';

/** Priority order: water beats road beats park beats city beats plain */
const PRIORITY: FeatureClass[] = ['water', 'road', 'park', 'city', 'plain'];

// ── OSM tag → feature class ───────────────────────────────────────────────

const ROAD_SKIP = new Set([
  'footway', 'path', 'cycleway', 'steps', 'pedestrian', 'track', 'corridor',
]);

function classifyTags(tags: Record<string, string>): FeatureClass | null {
  // Roads
  if (tags.highway && !ROAD_SKIP.has(tags.highway)) return 'road';

  // Water
  const nat = tags.natural;
  if (nat === 'water' || nat === 'wetland' || tags.waterway) return 'water';

  // Parks / green space
  if (nat === 'wood' || nat === 'scrub' || nat === 'grass' || nat === 'tree_row') return 'park';
  const leis = tags.leisure;
  if (leis === 'park' || leis === 'garden' || leis === 'nature_reserve') return 'park';
  const lu = tags.landuse;
  if (lu === 'grass' || lu === 'forest' || lu === 'meadow') return 'park';

  // Commercial / dense urban → City tile
  if (lu === 'commercial' || lu === 'retail' || lu === 'industrial') return 'city';

  // Residential / light urban → Plain
  if (lu === 'residential') return 'plain';

  return null;
}

function toTerrainType(cls: FeatureClass): TerrainType {
  switch (cls) {
    case 'water': return 'Water';
    case 'road':  return 'Road';
    case 'park':  return 'Forest';
    case 'city':  return 'City';
    case 'plain': return 'Plain';
  }
}

// ── Geometry helpers ──────────────────────────────────────────────────────

/** True when first and last node coincide (closed polygon). */
function isClosed(g: OsmNode[]): boolean {
  if (g.length < 3) return false;
  return (
    Math.abs(g[0].lat - g[g.length - 1].lat) < 1e-6 &&
    Math.abs(g[0].lon - g[g.length - 1].lon) < 1e-6
  );
}

/** Ray-casting point-in-polygon (uses lon as x, lat as y). */
function pointInPolygon(px: number, py: number, poly: OsmNode[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lon, yi = poly[i].lat;
    const xj = poly[j].lon, yj = poly[j].lat;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Minimum distance from point (px,py) to segment (a→b). */
function segDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True when any segment of the polyline passes within `thresh` of (px,py). */
function lineWithin(g: OsmNode[], px: number, py: number, thresh: number): boolean {
  for (let i = 0; i < g.length - 1; i++) {
    if (segDist(px, py, g[i].lon, g[i].lat, g[i + 1].lon, g[i + 1].lat) < thresh) {
      return true;
    }
  }
  return false;
}

// ── Cell ↔ feature matching ───────────────────────────────────────────────

interface Feature { cls: FeatureClass; geom: OsmNode[]; closed: boolean }

function matches(f: Feature, cx: number, cy: number, roadThresh: number): boolean {
  if (f.geom.length === 0) return false;
  if (f.cls === 'road') return lineWithin(f.geom, cx, cy, roadThresh);
  if (f.closed)         return pointInPolygon(cx, cy, f.geom);
  // open non-road ways (e.g. open waterway lines) — use line proximity
  return lineWithin(f.geom, cx, cy, roadThresh * 1.5);
}

// ── Public API ────────────────────────────────────────────────────────────

/** Overpass mirrors tried in order — kumi is usually faster than the main server. */
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/** Cache key based on location, so real terrain is only fetched once per location. */
function cacheKey(lng: number, lat: number) {
  return `realmap_${lng.toFixed(4)}_${lat.toFixed(4)}`;
}

async function fetchFromAnyEndpoint(query: string): Promise<{ elements: OsmElement[] }> {
  let lastErr: unknown;
  for (const base of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(`${base}?data=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(15_000), // 15 s per endpoint
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[realMap] endpoint ${base} failed:`, err);
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Fetches OSM terrain for a `gridSize × gridSize` game grid centred at
 * [centerLng, centerLat].  Each cell is `cellMeters` wide.
 *
 * Results are cached in localStorage so subsequent game loads are instant.
 * Returns null on complete failure (caller falls back to random terrain).
 */
export async function fetchRealTerrain(
  centerLng: number,
  centerLat: number,
  gridSize = GRID_SIZE,
  cellMeters = 100,
): Promise<TerrainType[][] | null> {
  // ── Check cache first ────────────────────────────────────────────────────
  const key = cacheKey(centerLng, centerLat);
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed: TerrainType[][] = JSON.parse(cached);
      console.info('[realMap] loaded terrain from cache');
      return parsed;
    }
  } catch { /* ignore quota/parse errors */ }

  try {
    const cellLat = cellMeters / METERS_PER_DEG_LAT;
    const cellLng = cellMeters / metersPerDegLng(centerLat);

    // Bounding box with a small margin
    const latMin = centerLat - (gridSize / 2) * cellLat - cellLat;
    const latMax = centerLat + (gridSize / 2) * cellLat + cellLat;
    const lngMin = centerLng - (gridSize / 2) * cellLng - cellLng;
    const lngMax = centerLng + (gridSize / 2) * cellLng + cellLng;

    const q = [
      '[out:json][timeout:20];(',
      `way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|service|living_street"](${latMin},${lngMin},${latMax},${lngMax});`,
      `way["natural"~"water|wood|scrub|grass|wetland"](${latMin},${lngMin},${latMax},${lngMax});`,
      `way["leisure"~"park|garden|nature_reserve"](${latMin},${lngMin},${latMax},${lngMax});`,
      `way["landuse"~"grass|forest|meadow|commercial|retail|industrial|residential"](${latMin},${lngMin},${latMax},${lngMax});`,
      ');out geom;',
    ].join('\n');

    const data = await fetchFromAnyEndpoint(q);

    // Build classified feature list
    const features: Feature[] = [];
    for (const el of data.elements ?? []) {
      if (el.type !== 'way' || !el.geometry?.length || !el.tags) continue;
      const cls = classifyTags(el.tags);
      if (!cls) continue;
      features.push({ cls, geom: el.geometry, closed: isClosed(el.geometry) });
    }

    // Road threshold: 20 m — a road must pass within 20 m of a cell centre.
    // At NYC's ~80 m street spacing, this creates clear road corridors.
    const roadThresh = 20 / METERS_PER_DEG_LAT;

    const terrain: TerrainType[][] = [];
    for (let y = 0; y < gridSize; y++) {
      terrain[y] = [];
      for (let x = 0; x < gridSize; x++) {
        // Row 0 = northernmost (highest lat), x=0 = westernmost
        const cx = centerLng + (x - (gridSize - 1) / 2) * cellLng;
        const cy = centerLat + ((gridSize - 1) / 2 - y) * cellLat;

        let result: TerrainType = 'Plain';
        for (const cls of PRIORITY) {
          const hit = features.find(f => f.cls === cls && matches(f, cx, cy, roadThresh));
          if (hit) { result = toTerrainType(cls); break; }
        }
        terrain[y][x] = result;
      }
    }

    // Persist so subsequent loads are instant
    try { localStorage.setItem(key, JSON.stringify(terrain)); } catch { /* quota full */ }
    console.info('[realMap] terrain fetched and cached');
    return terrain;
  } catch (err) {
    console.warn('[realMap] all endpoints failed — falling back to random terrain:', err);
    return null;
  }
}

/**
 * Convert a grid cell [x, y] to geographic [lng, lat] coordinates.
 * Useful for centering the MapLibre backdrop exactly on the game area.
 */
export function gridCellToLngLat(
  x: number,
  y: number,
  centerLng: number,
  centerLat: number,
  gridSize = GRID_SIZE,
  cellMeters = 100,
): [number, number] {
  const cellLat = cellMeters / METERS_PER_DEG_LAT;
  const cellLng = cellMeters / metersPerDegLng(centerLat);
  return [
    centerLng + (x - (gridSize - 1) / 2) * cellLng,
    centerLat + ((gridSize - 1) / 2 - y) * cellLat,
  ];
}
