# BattleforFunMiniApp - Game Documentation

## Project Overview

BattleforFunMiniApp is a turn-based strategy game inspired by Advance Wars, built with React 19, TypeScript, Tailwind CSS, `@react-three/fiber` for a 3D battlefield, and MapLibre GL JS for real-world map rendering. Players command units on a 10×10 grid that is overlaid directly on a real OpenStreetMap street map. Before the match, players pick a battle location anywhere in the world from the Lobby's interactive world map (defaults to Central Park / Upper West Side, NYC). The game includes an AI opponent with three difficulty levels.

## Table of Contents

- Game Features
- Technical Stack
- Game Mechanics
- AI Implementation
- 3D Rendering
- Project Structure
- Installation
- How to Play
- API Reference
- Future Enhancements

## Game Features

### Core Features

- **Turn-Based Gameplay**: Players alternate turns to move units and attack
- **Real-World Map Battlefield**: Units move directly on a live OpenStreetMap street map at the lobby-selected location. The 10×10 game grid is aligned to real geographic coordinates (~1 km² area, 100 m per cell). Terrain type (Road, Forest, City, etc.) is fetched from the Overpass API and cached in localStorage (keyed by lat/lng).
- **Lobby Location Picker**: Before starting, the host picks where to fight on an interactive MapLibre world map (`LocationPicker`). Click anywhere on the map or drag the red marker to choose any point on Earth; 6 preset cities (NYC, Paris, London, Tokyo, Rome, San Francisco) are available as quick picks. The chosen `[lng, lat]` is passed to `Game.tsx` via React Router navigation state (`location.state.battleLocation`).
- **Multiple Unit Types**: Infantry, Tanks, Artillery with distinct 3D shapes and stats
- **Health System**: Units have HP, attack, and defense values shown as floating labels
- **Movement and Attack Ranges**: Highlighted via colored overlay planes (blue = move, red = attack, yellow = selected)
- **Hover Highlight**: Mousing over any tile shows a white semi-transparent overlay
- **City Capture & Funds**: Infantry can capture neutral/enemy cities; capturing awards $1000
- **Counter-Attack System**: Close-range enemies (Infantry, Tank) retaliate when attacked; damage uses the same formula as a normal attack. Counter-attacks apply symmetrically — both when the player attacks AI units and when the AI attacks player units
- **Death Animation**: Defeated units play a fall-and-fade animation (collapse, tilt, sink) with rising white smoke particles over 600ms
- **Attack Animation**: Attacks fire an orange projectile ball that arcs from attacker to defender over 450ms, followed by a yellow impact flash on landing; counter-attacks fire a second projectile back immediately after the first lands
- **Sound Effects**: Synthesized audio via Tone.js for all combat events — attack, impact, destroy, counter-attack, move, select, capture, victory, defeat; mute toggle in the UI
- **MapLibre Terrain Backdrop**: A real OpenStreetMap raster map renders behind the transparent R3F canvas. There are no terrain tile meshes — units and decorations (trees, buildings, mountain peaks) sit directly on the map surface. The map bearing and pitch sync in real-time with the 3D camera via an imperative `MapLibreBackdropHandle` ref. The R3F canvas uses `gl={{ alpha: true, premultipliedAlpha: false }}` + a `SceneClear` component (via `useThree`) to ensure true WebGL compositing transparency. `MapLibreBackdrop` uses a `ResizeObserver` to defer map initialization until the container has non-zero CSS dimensions.
- **MapLibre Minimap**: A 144×144px MapLibre map overlaid in the bottom-right corner shows terrain tiles and live unit positions (red/blue dots). Uses a minimal offline style with no external tile server.

### AI Features

- **Single-Player Mode**: Play against a computer opponent (Blue)
- **Three Difficulty Levels**: Easy (random), Medium (prioritizes attacks), Hard (targets weakest enemies)
- **Automated Turn Execution**: AI acts every 3 seconds via interval
- **Intelligent Targeting**: AI prioritizes weak enemies and optimal positioning

## Technical Stack

- **Frontend Framework**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **3D Rendering**: `@react-three/fiber` v9 + `@react-three/drei` v9 + `three` v0.183
- **Map Rendering**: `maplibre-gl` — terrain backdrop + minimap overlay
- **Routing**: React Router v7
- **Icons**: Tabler Icons
- **Sound**: Tone.js (synthesized, no audio files)
- **Build Tool**: Vite

## Game Mechanics

### Unit System

```typescript
interface Unit {
  id: string;
  type: UnitType;        // 'Infantry' | 'Tank' | 'Artillery'
  health: number;
  attack: number;
  defense: number;
  moveRange: number;
  attackRange: number;
  position: [number, number];  // [x, y] grid coordinates (0–9)
  player: Player;              // 'Red' | 'Blue'
}
```

### Movement Rules

- **Dijkstra Pathfinding**: Movement respects terrain movement costs
- **Range Limit**: Units cannot move beyond their `moveRange`
- **Collision Detection**: Units cannot move onto occupied tiles
- **Grid Boundaries**: Movement is restricted to the 10×10 grid
- **Terrain Movement Costs**: Road 0.5, Plain/City 1, Forest 2, Mountain 3, Water 4 — Water is traversable but expensive, so only fast units (Tank `moveRange: 5`) can cross a single tile. Units never spawn on Water or Mountain tiles (`findPassableTile` in `Game.tsx`).

### Combat System

1. **Damage Calculation**:
```typescript
damage = max(10, attacker.attack - (defender.defense + terrain_defense_bonus))
// capped at defender.health
```

2. **Counter-Attack**: When a close-range enemy (`attackRange === 1`) survives a hit and the attacker is adjacent (distance ≤ 1), it immediately retaliates:
```typescript
counterDamage = calculateDamage(defender, attacker, attackerTerrain)
```
Artillery (`attackRange === 3`) never counter-attacks.

3. **Turn Sequence**: Move unit (optional) → Attack enemy (optional) → Unit goes on cooldown

4. **Unit Elimination**: Units with 0 HP are removed from the battlefield

### Economy System

- **Starting Funds**: Each player begins with $1000
- **City Capture**: Infantry on a City tile uses the Capture action; awards **$1000** when progress reaches 20
- **Spending Funds**: Funds spent to produce units at owned city factories (`handleBuyUnit` in `Game.tsx`)

### Win Conditions

- **Victory**: Eliminate all enemy units
- **Defeat**: Lose all your units (including via counter-attack)

### AP & Cooldown System

- **Max AP**: 10 per player
- **AP Cost**: 1 AP per move or attack
- **Cooldown**: Units lock for 10 seconds after any action
- **AP Regen**: +1 AP every 20 seconds

## AI Implementation

### Architecture

AI logic lives in `src/lib/ai.ts` as a pure function `computeAIAction()` that returns an action without touching React state. `Game.tsx` calls it on a 3-second interval.

```
Game.tsx: tryAIAction() (useCallback)
└── ai.ts: computeAIAction(context)
    ├── Find available Blue units (not on cooldown, have AP)
    ├── Pick unit (difficulty-based selection)
    ├── Try attack first (difficulty-based targeting)
    └── Fall back to move toward nearest enemy
    └── Returns { type, unit, newGrid } or null

tryAIAction then applies counter-attack damage on top of newGrid before
calling setGrid — so Red units retaliate against AI attacks just as they
do against player attacks.
```

### Difficulty Levels

| Difficulty | Unit Selection | Target Selection |
|------------|---------------|-----------------|
| Easy | Random | Random |
| Medium | Prefer units that can attack | Random attackable enemy |
| Hard | Prefer units near weak enemies | Lowest-HP enemy |

## 3D Rendering

### Architecture

The 3D board is in `src/components/GameBoard3D.tsx`. It receives pure data props from `Game.tsx` and handles all Three.js rendering. All game logic stays in `Game.tsx`.

```
Game.tsx (state, logic)
├── MapLibreBackdrop.tsx (absolute z:0 — OSM raster map; ResizeObserver init; setCamera() handle)
├── GameBoard3D.tsx (absolute z:1 — transparent Canvas + OrbitControls)
│   └── SceneClear (useThree — sets gl.setClearColor(0,0,0,0) + scene.background=null)
│   └── GridScene (ambientLight, directionalLight, OrbitControls)
│       ├── useFrame → computes bearing/pitch → calls mapBackdropRef.setCamera()
│       ├── Tile3D × 100 (one per grid cell — NO terrain mesh, units sit on the real map)
│       │   ├── Invisible hitbox plane (single raycast target, prevents hover flicker)
│       │   ├── Terrain decoration (mountain peak / forest tree / city buildings)
│       │   ├── Highlight overlay (blue/red/yellow transparent plane)
│       │   ├── Hover overlay (white transparent plane on pointer-over)
│       │   ├── Unit mesh (Infantry figure / tank hull+turret / artillery+barrel)
│       │   └── Html label (HP + cooldown timer via @react-three/drei)
│       ├── DyingUnit × N (fall-fade-tilt animation + smoke particles on unit death)
│       ├── Projectile (orange arc ball traveling attacker → defender on attack)
│       ├── Projectile (second ball defender → attacker for counter-attacks)
│       └── ImpactFlash × 1-2 (yellow plane burst at impact point; two shown when counter-attack occurs)
└── MinimapOverlay.tsx (absolute z:10 bottom-right — unit position minimap)
```

### Terrain Visual Config

There are **no terrain tile meshes** — the real OSM map provides the visual ground. Terrain type is used only for movement costs (game logic) and decoration placement.

| Terrain | OSM Source | Decoration |
|---------|-----------|------------|
| Plain | Residential / uncategorised | — |
| Road | `highway` tags (motorway→living_street) | — |
| Forest | `natural=wood/grass`, `leisure=park/garden` | Trunk + cone crown |
| Mountain | (random-gen only) | 4-sided peak cone |
| City | `landuse=commercial/retail/industrial` | Two box buildings (tinted by owner) |
| Water | `natural=water/wetland`, `waterway` | Semi-transparent flat blue plane |

### Unit 3D Models

| Unit | Shape | Notes |
|------|-------|-------|
| Infantry | Human figure (legs, torso, arms, head, helmet) holding an aiming rifle (brown stock + dark barrel) | Dimmed when on cooldown |
| Tank | Box hull + box turret + barrel cylinder | Barrel points forward |
| Artillery | Flat box base + angled long barrel | Barrel elevated ~36° |

### Camera & Controls

- **Initial position**: `[4.5, 13, 16]` looking toward `[4.5, 0, 4.5]`
- **OrbitControls**: drag to rotate, scroll to zoom, right-drag to pan
- `maxPolarAngle`: prevents camera going below ground

### MapLibre Backdrop Sync

`GridScene` runs a `useFrame` loop that computes **bearing** and **pitch** from the Three.js camera position relative to the orbit target `[4.5, 0, 4.5]`:

```typescript
bearing = atan2(dx, -dz) * (180 / π)           // clockwise from –Z (north)
pitch   = clamp(90 − atan2(dy, horiz) * (180/π), 0, 60)  // MapLibre: 0=top-down, 60=horizon
```

Updates are throttled to fire only when bearing changes >0.4°, pitch changes >0.4°, or zoom changes >0.05. Changes are pushed imperatively via `mapBackdropRef.current.setCamera(bearing, pitch, zoom)` — no React state update, no re-render. `MapLibreBackdrop` calls `map.jumpTo({ bearing, pitch, zoom })` for instant (zero-lag) sync.

Zoom is derived from camera distance to the orbit target:
```typescript
const BASE_DIST = Math.sqrt(13² + 11.5²)  // ≈ 17.36 — initial camera distance
const BASE_ZOOM = 15                        // MapLibre zoom at that distance
zoom = clamp(BASE_ZOOM - log2(dist / BASE_DIST), 10, 20)
// doubling camera distance → zoom −1; halving → zoom +1
```

### Canvas Transparency

The R3F `Canvas` uses `gl={{ alpha: true, premultipliedAlpha: false }}`. A `SceneClear` component inside the Canvas calls `gl.setClearColor(0x000000, 0)` and `scene.background = null` via `useThree` + `useEffect` — this is more reliable than `onCreated` because it runs inside the React commit cycle and isn't reset by R3F internals.

The board container in `Game.tsx` uses CSS stacking: `MapLibreBackdrop` at `position: absolute; inset: 0; z-index: 0`, `GameBoard3D` wrapper at `position: absolute; inset: 0; z-index: 1`. Both use `position: absolute; inset: 0` so they overlay exactly.

### MapLibreBackdrop Initialization

`MapLibreBackdrop` uses a `ResizeObserver` to defer `new maplibregl.Map(...)` until the container has non-zero `clientWidth`/`clientHeight`. This is required because the container is sized by CSS (`absolute inset-0`) and may have zero dimensions when React's `useEffect` first fires (before flex layout resolves). The style includes an explicit `background` layer (`#d4e9c8`) so the canvas is never transparent while tiles are loading.

### Click Handling & Hover Hitbox

Each `Tile3D` contains a single invisible `planeGeometry` hitbox mesh positioned just above the tile surface. All pointer events (`onClick`, `onPointerOver`, `onPointerOut`) are attached **only to this hitbox**, not to the `<group>`.

This is intentional — without it, the cursor moving between child meshes (terrain box, highlight plane, hover overlay, unit) causes r3f to fire `onPointerOut` + `onPointerOver` in quick succession as the raycast switches targets, producing a visible one-frame hover flicker. The single hitbox is always the topmost ray target, so hover state changes exactly once on enter and once on exit.

The hitbox passes the grid coordinate plus the native `clientX/clientY` to `Game.tsx` via `onTileClick(x, y, screenX, screenY)`. The screen coordinates are used to position the action/factory popup menus.

## UI Layout (Desktop)

On `lg+` screens the game uses a three-column layout that fills the full viewport:

- **Left sidebar** (`lg:w-56 xl:w-64`): game status, funds, AP bars, Next Unit button, AI controls
- **Center** (`flex-1`): 3D board — expands to fill all remaining horizontal and vertical space
- **Right sidebar** (`lg:w-48 xl:w-56`): camera controls reference, How to Play, unit type legend

On mobile the columns stack vertically and the page is scrollable. The canvas uses `height: 100%` with `minHeight: 420px` so it fills the center column on desktop.

Key CSS entry points:
- `html, body, #root { height: 100% }` in `src/index.css` — required for `h-screen` on the root game div
- Root game div: `flex flex-col h-screen overflow-hidden`
- Main area: `flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden`

## Project Structure

```
src/
├── pages/
│   ├── Game.tsx              # Main game component (state, logic, UI panels); reads battleLocation from router state
│   └── Lobby.tsx             # Pre-game lobby; players, settings, chat, and LocationPicker
├── components/
│   ├── GameBoard3D.tsx       # Transparent 3D canvas: units, decorations, highlights (r3f)
│   ├── LocationPicker.tsx    # Interactive MapLibre world map in the Lobby — click/drag marker or use presets
│   ├── MapLibreBackdrop.tsx  # OSM raster map behind the 3D canvas; ResizeObserver init; setCamera() handle
│   └── MinimapOverlay.tsx    # MapLibre minimap (terrain polygons + unit dots), bottom-right overlay
├── lib/
│   ├── ai.ts                 # AI decision logic (computeAIAction)
│   ├── combat.ts             # Damage calculation, win condition checks
│   ├── constants.ts          # Game constants, unit stats, terrain definitions
│   ├── grid.ts               # Grid generation, movement/attack range, terrain helpers
│   ├── realMap.ts            # Overpass API fetch → TerrainType[][] grid; localStorage cache; multi-endpoint fallback
│   ├── sounds.ts             # Tone.js synthesized sound effects (8 events)
│   └── units.ts              # Unit factory (createUnit)
└── types/
    └── game.ts               # Type definitions (Unit, Tile, Terrain, City, etc.)
```

## Installation

**Prerequisites**: Node.js 18+, npm

```bash
git clone https://github.com/ysongh/BattleforFunMiniApp.git
cd BattleforFunMiniApp
npm install        # includes maplibre-gl
npm run dev
```

## How to Play

### Lobby

1. **Pick your Battle Location**: On the world map in the right column, click anywhere to drop the marker, drag the marker to refine, or use a preset city (NYC, Paris, London, Tokyo, Rome, San Francisco).
2. Choose a faction, mark yourself Ready, optionally add AI opponents, and hit **Start Game**. The selected `[lng, lat]` is handed to `Game.tsx` via router state.

### Player Turn (Red)

1. **Select a Unit**: Click on one of your red units in the 3D scene
2. **Move**: Click a blue-highlighted tile to move there
3. **Attack**: Click a red-highlighted enemy tile to attack
4. **Action Menu**: After moving near an enemy or city, choose Capture / Attack / Wait
5. **Factory**: Click an owned empty city to open the unit production menu

### Camera Navigation

- **Rotate**: Left-click drag
- **Zoom**: Scroll wheel
- **Pan**: Right-click drag

### Strategy Tips

- Use Artillery (long range, no counter-attack) to weaken enemies before moving Infantry/Tanks in
- Capture cities with Infantry to earn $1000 and produce reinforcements
- Units on cooldown are dimmed — check the floating timer before planning attacks
- AP regenerates over time — avoid wasting it on low-value moves

## API Reference

### GameBoard3D Props

```typescript
interface GameBoard3DProps {
  grid: Tile[][];
  selectedUnit: Unit | null;
  movementRange: [number, number][];
  attackRange: [number, number][];
  unitCooldowns: Record<string, number>;
  now: number;
  onTileClick: (x: number, y: number, screenX: number, screenY: number) => void;
  attackEvent: { attackerPos: [number, number]; defenderPos: [number, number]; timestamp: number; hasCounter: boolean } | null;
  mapBackdropRef?: React.RefObject<MapLibreBackdropHandle | null>;  // optional; camera sync to MapLibre
}
```

### MapLibreBackdropHandle

```typescript
export interface MapLibreBackdropHandle {
  setCamera: (bearing: number, pitch: number, zoom: number) => void;
}
```

Obtained via `useRef<MapLibreBackdropHandle | null>(null)` in `Game.tsx` and passed as `ref` to `<MapLibreBackdrop>`.

### LocationPicker Props

```typescript
interface LocationPickerProps {
  value: [number, number];                           // [lng, lat]
  onChange: (lngLat: [number, number]) => void;
}
```

Used by `Lobby.tsx`. Renders a full-interactive MapLibre raster map (OSM tiles) with a draggable red marker and 6 preset cities. Parent preset changes trigger `map.flyTo({ center, zoom: 13 })`; marker drags and map clicks emit `onChange`.

### Lobby → Game Navigation State

```typescript
// Lobby.tsx
navigate('/game', {
  state: {
    isAIEnabled,
    aiDifficulty,
    battleLocation,    // [lng, lat]
  },
});

// Game.tsx
const lobbyState = location.state as {
  isAIEnabled?: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  battleLocation?: [number, number];
} | null;
const MAP_CENTER: [number, number] = lobbyState?.battleLocation ?? DEFAULT_MAP_CENTER;
```

`MAP_CENTER` feeds both `fetchRealTerrain(lng, lat)` for Overpass terrain lookup and `<MapLibreBackdrop center={MAP_CENTER} />`.

### Key State in Game.tsx

```typescript
const [grid, setGrid] = useState<Tile[][]>([]);
const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
const [movementRange, setMovementRange] = useState<[number, number][]>([]);
const [attackRange, setAttackRange] = useState<[number, number][]>([]);
const [actionPoints, setActionPoints] = useState<Record<Player, number>>({ Red: 5, Blue: 5 });
const [unitCooldowns, setUnitCooldowns] = useState<Record<string, number>>({});
const [resources, setResources] = useState<Record<Player, number>>({ Red: 1000, Blue: 1000 });
const [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number; openAbove: boolean } | null>(null);
const [isAIEnabled, setIsAIEnabled] = useState(false);
const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
const [attackEvent, setAttackEvent] = useState<{ attackerPos: [number, number]; defenderPos: [number, number]; timestamp: number; hasCounter: boolean } | null>(null);
const [isMuted, setIsMuted] = useState(false);
```

## Future Enhancements

### Gameplay

- Fog of War: hide enemy units outside vision range
- Special Abilities: unique per-unit abilities
- Multiple Maps: different battlefield layouts

### 3D / Visual

- Unit movement animation: tween position from old to new tile
- Camera auto-pan: smooth camera follow when selecting units
- Terrain shadows and ambient occlusion

### AI

- Predictive analysis: consider player's potential responses
- Defensive positioning: protect weak units
- Tactical retreat: move wounded units away from enemies

### Technical

- Multiplayer (online)
- Save/Load game state
- Mobile touch controls optimized for 3D

---

Version: 1.12.0
Last Updated: April 2026
