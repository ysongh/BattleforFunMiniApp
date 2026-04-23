# BattleforFunMiniApp

A turn-based strategy game inspired by Advance Wars, built with React 19, TypeScript, Tailwind CSS, `@react-three/fiber`, and MapLibre GL JS. Command units on a square grid (10×10, 20×20, or 30×30) overlaid on a real OpenStreetMap street map — pick any location on Earth from the lobby and fight there.

## Features

### Gameplay
- **Turn-based combat** on a real-world OSM map at the location you pick in the lobby
- **Selectable map size** (10×10 / 20×20 / 30×30) with 15 m cells — units roughly match real street width
- **Lobby location picker**: click anywhere on the world map, drag the marker, or use preset cities (NYC, Paris, London, Tokyo, Rome, San Francisco)
- **4 unit types**: Infantry, Tank, Artillery, Chopper — each with unique 3D models and stats. Choppers fly over every terrain
- **Real terrain**: Roads, Forest, City, Water, Mountain fetched from the Overpass API (cached in localStorage). Terrain affects movement cost and defense
- **City capture & funds**: Infantry capture neutral/enemy cities for $1000; spend funds on unit production
- **Counter-attacks**: close-range units (Infantry, Tank) retaliate when attacked; Artillery never counters
- **AP & cooldowns**: 10 AP per player, +1 AP every 20s; units lock for 10s after any action

### AI
- **Single-player vs AI** (Blue) with three difficulty levels (Easy / Medium / Hard)
- AI targets weak enemies, produces units from owned cities, and adapts its production preference based on force balance

### Visuals & Audio
- **3D battlefield** (`@react-three/fiber`) — transparent WebGL canvas composited over a live MapLibre OSM raster map
- **Camera-synced backdrop**: MapLibre bearing/pitch/zoom track the Three.js orbit camera in real time (throttled imperative `setCamera`)
- **Minimap** overlay (bottom-right) with terrain polygons and live red/blue unit dots
- **Attack animation**: orange projectile + yellow impact flash. Trajectory depends on shot distance:
  - **Close-range (distance ≤ 1.5 cells — Infantry, Tank, Chopper vs adjacent target)**: flat straight-line shot, no arc, ~247ms travel
  - **Long-range (Artillery)**: tall parabolic arc (`arcHeight = 1.2 + dist * 0.35`), 450ms travel
  - Impact flash and counter-attack timing scale with actual travel time
- **Death animation**: 600ms fall-tilt-sink + rising white smoke particles
- **Sound effects**: synthesized via Tone.js (attack, impact, destroy, counter, move, select, capture, victory, defeat) with mute toggle

## Tech Stack

- **Frontend framework**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **3D rendering**: `@react-three/fiber` v9 + `@react-three/drei` v9 + `three` v0.183
- **Map rendering**: `maplibre-gl` — OSM raster backdrop, minimap, and lobby location picker
- **Routing**: React Router v7
- **Icons**: Tabler Icons
- **Audio**: Tone.js (synthesized, no audio files)
- **Data source**: Overpass API (real-world terrain fetch, cached in `localStorage`)
- **Build tool**: Vite

## Installation

Requires Node.js 18+ and npm.

```bash
git clone https://github.com/ysongh/BattleforFunMiniApp.git
cd BattleforFunMiniApp
npm install
npm run dev
```

## How to Play

### Lobby
1. **Pick a battle location** on the interactive world map (click, drag, or preset)
2. **Pick AI difficulty** (Easy / Medium / Hard)
3. **Pick map size** (10×10 / 20×20 / 30×30)
4. Hit **Start Game**

### Your turn (Red)
1. Click one of your red units to select it
2. Click a **blue** tile to move, or a **red** tile to attack
3. Open the action menu after moving near an enemy or city to Capture / Attack / Wait
4. Click an owned empty city to open the factory and produce a new unit

### Camera
- **Rotate**: left-click drag
- **Zoom**: scroll wheel
- **Pan**: right-click drag

## Project Structure

```
src/
├── pages/           Game.tsx (state + logic), Lobby.tsx (location picker, settings)
├── components/      GameBoard3D, MapLibreBackdrop, MinimapOverlay, LocationPicker
├── lib/             ai, combat, constants, grid, realMap (Overpass), sounds, units
└── types/           game.ts (Unit, Tile, Terrain, City types)
```

See `CLAUDE.md` for deep architecture docs — rendering pipeline, camera-sync math, AI decision flow, and terrain config.

---

## Farcaster Mini-App Setup

This is a [Vite](https://vitejs.dev) project bootstrapped with [`@farcaster/create-mini-app`](https://github.com/farcasterxyz/frames/tree/main/packages/create-mini-app).

## `farcaster.json`

The `/.well-known/farcaster.json` is served from the [public
directory](https://vite.dev/guide/assets) and can be updated by editing
`./public/.well-known/farcaster.json`.

You can also use the `public` directory to serve a static image for `splashBackgroundImageUrl`.

## Frame Embed

Add a the `fc:frame` in `index.html` to make your root app URL sharable in feeds:

```html
  <head>
    <!--- other tags --->
    <meta name="fc:frame" content='{"version":"next","imageUrl":"https://placehold.co/900x600.png?text=Frame%20Image","button":{"title":"Open","action":{"type":"launch_frame","name":"App Name","url":"https://app.com"}}}' /> 
  </head>
```
