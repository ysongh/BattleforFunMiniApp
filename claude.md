# BattleforFunMiniApp - Game Documentation

## Project Overview

BattleforFunMiniApp is a turn-based strategy game inspired by Advance Wars, built with React 19, TypeScript, Tailwind CSS, `@react-three/fiber` for a 3D battlefield, and MapLibre GL JS for map overlays. Players command units on a 10×10 grid rendered in full 3D with an isometric-style perspective camera. The game includes an AI opponent with three difficulty levels.

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
- **3D Grid Battlefield**: 10×10 battlefield rendered in 3D with terrain elevation and unit models
- **Multiple Unit Types**: Infantry, Tanks, Artillery with distinct 3D shapes and stats
- **Health System**: Units have HP, attack, and defense values shown as floating labels
- **Movement and Attack Ranges**: Highlighted via colored overlay planes (blue = move, red = attack, yellow = selected)
- **Hover Highlight**: Mousing over any tile shows a white semi-transparent overlay; visible on plain tiles and brightens movement/attack/selected highlights
- **City Capture & Funds**: Infantry can capture neutral/enemy cities; capturing awards $1000
- **Counter-Attack System**: Close-range enemies (Infantry, Tank) retaliate when attacked; damage uses the same formula as a normal attack. Counter-attacks apply symmetrically — both when the player attacks AI units and when the AI attacks player units
- **Death Animation**: Defeated units play a fall-and-fade animation (collapse, tilt, sink) with rising white smoke particles over 600ms
- **Attack Animation**: Attacks fire an orange projectile ball that arcs from attacker to defender over 450ms, followed by a yellow impact flash on landing; counter-attacks fire a second projectile back immediately after the first lands
- **Sound Effects**: Synthesized audio via Tone.js for all combat events — attack, impact, destroy, counter-attack, move, select, capture, victory, defeat; mute toggle in the UI
- **MapLibre Terrain Backdrop**: A real-world MapLibre GL JS map (OpenFreeMap bright style, centered on Alsace-Lorraine) renders behind the transparent R3F canvas. The map bearing and pitch sync in real-time with the 3D camera via an imperative `MapLibreBackdropHandle` ref — no React re-renders during camera movement. The R3F canvas uses `gl={{ alpha: true }}` + `scene.background = null` for true compositing transparency.
- **MapLibre Minimap**: A 144×144px MapLibre map overlaid in the bottom-right corner of the board shows terrain tiles and live unit positions (red/blue dots). Uses a minimal offline style with no external tile server.

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
├── MapLibreBackdrop.tsx (absolute z:0 — real-world map behind the canvas)
├── GameBoard3D.tsx (relative z:1 — transparent Canvas + OrbitControls)
│   └── GridScene (ambientLight, directionalLight, OrbitControls)
│       ├── useFrame → computes bearing/pitch → calls mapBackdropRef.setCamera()
│       ├── Tile3D × 100 (one per grid cell)
│       │   ├── Terrain mesh (box with terrain-appropriate height/color)
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

| Terrain | Color | Height | Decoration |
|---------|-------|--------|------------|
| Plain | `#86efac` | 0.12 | — |
| Road | `#d97706` | 0.06 | — |
| Forest | `#15803d` | 0.18 | Trunk + cone crown |
| Mountain | `#6b7280` | 0.55 | 4-sided peak cone |
| City | `#fde68a` | 0.15 | Two box buildings (tinted by owner) |

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

Updates are throttled to fire only when either value changes by >0.4°. Changes are pushed imperatively via `mapBackdropRef.current.setCamera(bearing, pitch)` — no React state update, no re-render. `MapLibreBackdrop` calls `map.jumpTo({ bearing, pitch })` for instant (zero-lag) sync.

### Canvas Transparency

The R3F `Canvas` uses `gl={{ alpha: true }}` and `onCreated={({ gl, scene }) => { gl.setClearColor(0x000000, 0); scene.background = null; }}`. Both `gl.setClearColor` (clears the WebGL buffer to transparent) and `scene.background = null` (prevents Three.js from painting over the clear) are required for compositing over the MapLibre backdrop.

The board container in `Game.tsx` uses CSS stacking: `MapLibreBackdrop` at `position: absolute; z-index: 0`, `GameBoard3D` wrapper at `position: relative; z-index: 1`.

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
│   ├── Game.tsx              # Main game component (state, logic, UI panels)
│   └── Lobby.tsx             # Pre-game lobby and settings
├── components/
│   ├── GameBoard3D.tsx       # 3D canvas: tiles, units, highlights (r3f)
│   ├── MapLibreBackdrop.tsx  # MapLibre real-world map behind the 3D canvas; exposes setCamera() handle
│   └── MinimapOverlay.tsx    # MapLibre minimap (terrain polygons + unit dots), bottom-right overlay
├── lib/
│   ├── ai.ts                 # AI decision logic (computeAIAction)
│   ├── combat.ts             # Damage calculation, win condition checks
│   ├── constants.ts          # Game constants, unit stats, terrain definitions
│   ├── grid.ts               # Grid generation, movement/attack range, terrain helpers
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
  setCamera: (bearing: number, pitch: number) => void;
}
```

Obtained via `useRef<MapLibreBackdropHandle | null>(null)` in `Game.tsx` and passed as `ref` to `<MapLibreBackdrop>`.

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

Version: 1.8.0
Last Updated: April 2026
