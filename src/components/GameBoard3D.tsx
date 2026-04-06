import { useRef } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type { Tile, Unit, TerrainType, City } from '../types/game';

// ── Terrain visual config ──────────────────────────────────────────────────

const TERRAIN_COLOR: Record<TerrainType, string> = {
  Plain: '#86efac',
  Road: '#d97706',
  Forest: '#15803d',
  Mountain: '#6b7280',
  City: '#fde68a',
};

const TERRAIN_HEIGHT: Record<TerrainType, number> = {
  Plain: 0.12,
  Road: 0.06,
  Forest: 0.18,
  Mountain: 0.55,
  City: 0.15,
};

const UNIT_BASE_COLOR: Record<string, string> = {
  Red: '#ef4444',
  Blue: '#3b82f6',
};

const UNIT_DIM_COLOR: Record<string, string> = {
  Red: '#fca5a5',
  Blue: '#93c5fd',
};

const CITY_OWNER_COLOR: Record<string, string> = {
  Red: '#fca5a5',
  Blue: '#93c5fd',
  none: '#d1d5db',
};

// ── Single tile ────────────────────────────────────────────────────────────

interface TileProps {
  tile: Tile;
  isSelected: boolean;
  isMovement: boolean;
  isAttack: boolean;
  isUnitOnCooldown: boolean;
  cooldownSecs: number;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

function Tile3D({ tile, isSelected, isMovement, isAttack, isUnitOnCooldown, cooldownSecs, onClick }: TileProps) {
  const [gx, gy] = tile.position;
  const terrainType = tile.terrain.type;
  const h = TERRAIN_HEIGHT[terrainType];
  const color = TERRAIN_COLOR[terrainType];
  const unit = tile.unit;

  // Highlight ring color priority: selected > movement > attack
  const highlightColor = isSelected
    ? '#facc15'
    : isMovement
      ? '#60a5fa'
      : isAttack
        ? '#f87171'
        : null;

  const isCity = tile.terrain.isCity;
  const city = isCity ? (tile.terrain as City) : null;
  const cityOwnerKey = city?.owner ?? 'none';

  return (
    <group position={[gx, 0, gy]} onClick={onClick}>

      {/* Base tile */}
      <mesh position={[0, h / 2, 0]} receiveShadow>
        <boxGeometry args={[0.96, h, 0.96]} />
        <meshLambertMaterial color={color} />
      </mesh>

      {/* Mountain peak */}
      {terrainType === 'Mountain' && (
        <mesh position={[0, h + 0.22, 0]}>
          <coneGeometry args={[0.28, 0.44, 4]} />
          <meshLambertMaterial color="#9ca3af" />
        </mesh>
      )}

      {/* Forest tree trunk + crown */}
      {terrainType === 'Forest' && (
        <>
          <mesh position={[0, h + 0.08, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.16, 6]} />
            <meshLambertMaterial color="#92400e" />
          </mesh>
          <mesh position={[0, h + 0.28, 0]}>
            <coneGeometry args={[0.22, 0.36, 6]} />
            <meshLambertMaterial color="#166534" />
          </mesh>
        </>
      )}

      {/* City buildings */}
      {isCity && (
        <>
          <mesh position={[0.16, h + 0.16, 0.16]}>
            <boxGeometry args={[0.24, 0.32, 0.24]} />
            <meshLambertMaterial color={CITY_OWNER_COLOR[cityOwnerKey]} />
          </mesh>
          <mesh position={[-0.14, h + 0.22, -0.14]}>
            <boxGeometry args={[0.2, 0.44, 0.2]} />
            <meshLambertMaterial color={CITY_OWNER_COLOR[cityOwnerKey]} />
          </mesh>
          {/* Capture progress bar */}
          {city && city.captureProgress > 0 && (
            <mesh position={[0, h + 0.01, 0.42]}>
              <boxGeometry args={[(city.captureProgress / 20) * 0.9, 0.04, 0.06]} />
              <meshLambertMaterial color="#eab308" />
            </mesh>
          )}
        </>
      )}

      {/* Highlight overlay */}
      {highlightColor && (
        <mesh position={[0, h + 0.015, 0]}>
          <boxGeometry args={[0.96, 0.03, 0.96]} />
          <meshLambertMaterial color={highlightColor} transparent opacity={0.55} />
        </mesh>
      )}

      {/* Unit mesh */}
      {unit && (
        <group position={[0, h, 0]}>
          {unit.type === 'Infantry' && (
            <group>
              {/* Left leg */}
              <mesh position={[-0.065, 0.09, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.045, 0.18, 6]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
              {/* Right leg */}
              <mesh position={[0.065, 0.09, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.045, 0.18, 6]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
              {/* Torso */}
              <mesh position={[0, 0.29, 0]} castShadow>
                <boxGeometry args={[0.2, 0.2, 0.13]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
              {/* Left arm */}
              <mesh position={[-0.15, 0.28, 0]} rotation={[0, 0, Math.PI / 5]} castShadow>
                <cylinderGeometry args={[0.035, 0.035, 0.18, 6]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
              {/* Right arm */}
              <mesh position={[0.15, 0.28, 0]} rotation={[0, 0, -Math.PI / 5]} castShadow>
                <cylinderGeometry args={[0.035, 0.035, 0.18, 6]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
              {/* Head (skin tone) */}
              <mesh position={[0, 0.48, 0]} castShadow>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshLambertMaterial color={isUnitOnCooldown ? '#d4a06a' : '#fbbf24'} />
              </mesh>
              {/* Helmet */}
              <mesh position={[0, 0.535, 0]}>
                <cylinderGeometry args={[0.11, 0.09, 0.07, 8]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
            </group>
          )}
          {unit.type === 'Tank' && (
            <>
              {/* Hull */}
              <mesh position={[0, 0.14, 0]} castShadow>
                <boxGeometry args={[0.42, 0.28, 0.42]} />
                <meshLambertMaterial
                  color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]}
                />
              </mesh>
              {/* Turret */}
              <mesh position={[0, 0.32, 0]}>
                <boxGeometry args={[0.26, 0.18, 0.26]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
              {/* Barrel */}
              <mesh position={[0.28, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
                <meshLambertMaterial color="#374151" />
              </mesh>
            </>
          )}
          {unit.type === 'Artillery' && (
            <>
              {/* Base */}
              <mesh position={[0, 0.1, 0]} castShadow>
                <boxGeometry args={[0.38, 0.2, 0.38]} />
                <meshLambertMaterial
                  color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]}
                />
              </mesh>
              {/* Long barrel angled up */}
              <mesh position={[0.18, 0.28, 0]} rotation={[0, 0, -Math.PI / 5]}>
                <cylinderGeometry args={[0.05, 0.05, 0.46, 6]} />
                <meshLambertMaterial color="#374151" />
              </mesh>
            </>
          )}

          {/* HP + cooldown label */}
          <Html position={[0, 0.72, 0]} center distanceFactor={7}>
            <div
              style={{
                background: 'rgba(0,0,0,0.72)',
                color: 'white',
                padding: '1px 4px',
                borderRadius: 3,
                fontSize: 10,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {unit.health}hp{isUnitOnCooldown ? ` ⏱${cooldownSecs}s` : ''}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

// ── Grid scene (inside Canvas) ─────────────────────────────────────────────

interface GridSceneProps {
  grid: Tile[][];
  selectedUnit: Unit | null;
  movementRange: [number, number][];
  attackRange: [number, number][];
  unitCooldowns: Record<string, number>;
  now: number;
  onTileClick: (x: number, y: number, screenX: number, screenY: number) => void;
}

function GridScene({ grid, selectedUnit, movementRange, attackRange, unitCooldowns, now, onTileClick }: GridSceneProps) {
  const moveSet = new Set(movementRange.map(([x, y]) => `${x},${y}`));
  const attackSet = new Set(attackRange.map(([x, y]) => `${x},${y}`));

  const isUnitOnCooldown = (id: string) => {
    const cd = unitCooldowns[id];
    return cd !== undefined && now < cd;
  };

  const getCooldownSecs = (id: string) => {
    const cd = unitCooldowns[id];
    if (!cd || now >= cd) return 0;
    return Math.ceil((cd - now) / 1000);
  };

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[8, 14, 8]} intensity={1.1} castShadow />
      <OrbitControls
        target={[4.5, 0, 4.5]}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={24}
      />

      {grid.map(row =>
        row.map(tile => {
          const [tx, ty] = tile.position;
          const key = `${tx},${ty}`;
          const unit = tile.unit;
          const onCd = unit ? isUnitOnCooldown(unit.id) : false;
          const cdSecs = unit ? getCooldownSecs(unit.id) : 0;
          const isSel =
            !!selectedUnit &&
            selectedUnit.position[0] === tx &&
            selectedUnit.position[1] === ty;

          return (
            <Tile3D
              key={key}
              tile={tile}
              isSelected={isSel}
              isMovement={moveSet.has(key)}
              isAttack={attackSet.has(key)}
              isUnitOnCooldown={onCd}
              cooldownSecs={cdSecs}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onTileClick(tx, ty, e.nativeEvent.clientX, e.nativeEvent.clientY);
              }}
            />
          );
        })
      )}
    </>
  );
}

// ── Public component ───────────────────────────────────────────────────────

export interface GameBoard3DProps {
  grid: Tile[][];
  selectedUnit: Unit | null;
  movementRange: [number, number][];
  attackRange: [number, number][];
  unitCooldowns: Record<string, number>;
  now: number;
  onTileClick: (x: number, y: number, screenX: number, screenY: number) => void;
}

export default function GameBoard3D(props: GameBoard3DProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!props.grid.length) return null;

  return (
    <div ref={canvasRef} style={{ width: '100%', height: 520, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
      <Canvas
        camera={{ position: [4.5, 13, 16], fov: 42 }}
        shadows
        gl={{ antialias: true }}
      >
        <GridScene {...props} />
      </Canvas>
    </div>
  );
}
