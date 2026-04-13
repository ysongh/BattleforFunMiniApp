import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
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
  isHovered: boolean;
  isUnitOnCooldown: boolean;
  cooldownSecs: number;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

function Tile3D({ tile, isSelected, isMovement, isAttack, isHovered, isUnitOnCooldown, cooldownSecs, onClick, onPointerOver, onPointerOut }: TileProps) {
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
    <group position={[gx, 0, gy]}>

      {/* Invisible hitbox — single ray target for click/hover, prevents flicker from child mesh transitions */}
      <mesh
        position={[0, h + 0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <planeGeometry args={[0.96, 0.96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

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

      {/* Hover overlay */}
      {isHovered && (
        <mesh position={[0, h + 0.03, 0]}>
          <boxGeometry args={[0.96, 0.03, 0.96]} />
          <meshLambertMaterial color="#ffffff" transparent opacity={0.28} />
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
              {/* Left arm — support hand on barrel */}
              <mesh position={[0.02, 0.37, -0.07]} rotation={[-0.5, 0, 0.15]} castShadow>
                <cylinderGeometry args={[0.035, 0.035, 0.18, 6]} />
                <meshLambertMaterial color={isUnitOnCooldown ? UNIT_DIM_COLOR[unit.player] : UNIT_BASE_COLOR[unit.player]} />
              </mesh>
              {/* Right arm — trigger hand gripping stock */}
              <mesh position={[0.13, 0.32, 0.03]} rotation={[-0.55, 0, -0.2]} castShadow>
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
              {/* Rifle stock — at right shoulder */}
              <mesh position={[0.1, 0.38, 0.1]} rotation={[-Math.PI / 2 + 0.2, 0, 0.06]}>
                <boxGeometry args={[0.04, 0.09, 0.04]} />
                <meshLambertMaterial color="#78350f" />
              </mesh>
              {/* Rifle barrel — pointing forward with slight upward angle */}
              <mesh position={[0.07, 0.42, -0.06]} rotation={[-Math.PI / 2 + 0.2, 0, 0.06]}>
                <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
                <meshLambertMaterial color="#1f2937" />
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

// ── Death animation component ──────────────────────────────────────────────

interface DyingEntry {
  unit: Unit;
  gx: number;
  gy: number;
  h: number;
  startTime: number;
}

const DEATH_DURATION = 600; // ms

// ── Smoke particles ────────────────────────────────────────────────────────

const SMOKE_COUNT = 7;

// Stable per-particle random offsets (generated once per mount)
function makeParticles() {
  return Array.from({ length: SMOKE_COUNT }, () => ({
    dx: (Math.random() - 0.5) * 0.6,
    dz: (Math.random() - 0.5) * 0.6,
    speed: 0.9 + Math.random() * 0.8,
    size: 0.06 + Math.random() * 0.07,
    delay: Math.random() * 0.25, // fraction of DEATH_DURATION before this puff appears
  }));
}

function SmokeParticles({ startTime }: { startTime: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const particles = useRef(makeParticles());

  useFrame(() => {
    const elapsed = (performance.now() - startTime) / DEATH_DURATION; // 0..1+

    particles.current.forEach((p, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;

      const localT = Math.max(0, (elapsed - p.delay) / (1 - p.delay));
      if (localT <= 0) { mesh.visible = false; return; }

      const t = Math.min(localT, 1);
      mesh.visible = true;
      mesh.position.set(p.dx * t, 0.6 + p.speed * t, p.dz * t);
      mesh.scale.setScalar(1 + t * 0.8);

      const mat = mesh.material as THREE.MeshLambertMaterial;
      mat.opacity = (1 - t) * 0.55;
    });
  });

  return (
    <>
      {particles.current.map((p, i) => (
        <mesh
          key={i}
          ref={el => { refs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshLambertMaterial color="white" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function DyingUnit({ entry, onDone }: { entry: DyingEntry; onDone: (id: string) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const done = useRef(false);

  useFrame(() => {
    if (done.current || !groupRef.current) return;
    const elapsed = performance.now() - entry.startTime;
    const t = Math.min(elapsed / DEATH_DURATION, 1);

    groupRef.current.scale.set(1 - t * 0.8, 1 - t, 1 - t * 0.8);
    groupRef.current.position.y = entry.h - t * 0.15;
    groupRef.current.rotation.z = t * (Math.PI / 3);

    groupRef.current.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshLambertMaterial;
        if (!mat.transparent) {
          mat.transparent = true;
          mat.needsUpdate = true;
        }
        mat.opacity = 1 - t;
      }
    });

    if (t >= 1) {
      done.current = true;
      onDone(entry.unit.id);
    }
  });

  const { unit, gx, gy, h } = entry;
  const color = UNIT_BASE_COLOR[unit.player];
  const dimColor = UNIT_DIM_COLOR[unit.player];

  return (
    <group ref={groupRef} position={[gx, h, gy]}>
      <SmokeParticles startTime={entry.startTime} />
      {unit.type === 'Infantry' && (
        <group>
          <mesh position={[-0.065, 0.09, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.18, 6]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0.065, 0.09, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.18, 6]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.29, 0]}>
            <boxGeometry args={[0.2, 0.2, 0.13]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0.02, 0.37, -0.07]} rotation={[-0.5, 0, 0.15]}>
            <cylinderGeometry args={[0.035, 0.035, 0.18, 6]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0.13, 0.32, 0.03]} rotation={[-0.55, 0, -0.2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.18, 6]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.48, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshLambertMaterial color="#fbbf24" />
          </mesh>
          <mesh position={[0, 0.535, 0]}>
            <cylinderGeometry args={[0.11, 0.09, 0.07, 8]} />
            <meshLambertMaterial color={color} />
          </mesh>
          {/* Rifle stock — at right shoulder */}
          <mesh position={[0.1, 0.38, 0.1]} rotation={[-Math.PI / 2 + 0.2, 0, 0.06]}>
            <boxGeometry args={[0.04, 0.09, 0.04]} />
            <meshLambertMaterial color="#78350f" />
          </mesh>
          {/* Rifle barrel — pointing forward with slight upward angle */}
          <mesh position={[0.07, 0.42, -0.06]} rotation={[-Math.PI / 2 + 0.2, 0, 0.06]}>
            <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
            <meshLambertMaterial color="#1f2937" />
          </mesh>
        </group>
      )}
      {unit.type === 'Tank' && (
        <>
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[0.42, 0.28, 0.42]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.26, 0.18, 0.26]} />
            <meshLambertMaterial color={dimColor} />
          </mesh>
          <mesh position={[0.28, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
            <meshLambertMaterial color="#374151" />
          </mesh>
        </>
      )}
      {unit.type === 'Artillery' && (
        <>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.38, 0.2, 0.38]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0.18, 0.28, 0]} rotation={[0, 0, -Math.PI / 5]}>
            <cylinderGeometry args={[0.05, 0.05, 0.46, 6]} />
            <meshLambertMaterial color="#374151" />
          </mesh>
        </>
      )}
    </group>
  );
}

// ── Attack animations ──────────────────────────────────────────────────────

const PROJECTILE_DURATION = 450; // ms — travel time attacker → defender
const FLASH_DURATION = 280;      // ms — impact flash fade

function Projectile({ attackerPos, defenderPos, ah, dh, startTime }: {
  attackerPos: [number, number];
  defenderPos: [number, number];
  ah: number;
  dh: number;
  startTime: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const pdx = defenderPos[0] - attackerPos[0];
  const pdz = defenderPos[1] - attackerPos[1];
  const dist = Math.sqrt(pdx * pdx + pdz * pdz);
  const arcHeight = 0.5 + dist * 0.18; // taller arc for longer shots

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / PROJECTILE_DURATION, 1);

    const x = attackerPos[0] + pdx * t;
    const z = attackerPos[1] + pdz * t;
    const baseY = ah + (dh - ah) * t + 0.35; // start slightly above tile
    const arcY = Math.sin(t * Math.PI) * arcHeight;

    meshRef.current.position.set(x, baseY + arcY, z);
    meshRef.current.visible = t < 1;
  });

  return (
    <mesh ref={meshRef} position={[attackerPos[0], ah + 0.35, attackerPos[1]]} visible={false}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshLambertMaterial color="#f97316" />
    </mesh>
  );
}

function ImpactFlash({ defenderPos, h, startTime, delay }: {
  defenderPos: [number, number];
  h: number;
  startTime: number;
  delay: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = performance.now() - (startTime + delay);
    if (elapsed < 0) { meshRef.current.visible = false; return; }
    const t = Math.min(elapsed / FLASH_DURATION, 1);
    meshRef.current.visible = true;
    const mat = meshRef.current.material as THREE.MeshLambertMaterial;
    mat.opacity = (1 - t) * 0.9;
    meshRef.current.scale.setScalar(1 + t * 0.8);
  });

  return (
    <mesh
      ref={meshRef}
      position={[defenderPos[0], h + 0.04, defenderPos[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
    >
      <planeGeometry args={[0.9, 0.9]} />
      <meshLambertMaterial color="#fbbf24" transparent opacity={0} depthWrite={false} />
    </mesh>
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
  attackEvent: { attackerPos: [number, number]; defenderPos: [number, number]; timestamp: number; hasCounter: boolean } | null;
}

function GridScene({ grid, selectedUnit, movementRange, attackRange, unitCooldowns, now, onTileClick, attackEvent }: GridSceneProps) {
  const moveSet = new Set(movementRange.map(([x, y]) => `${x},${y}`));
  const attackSet = new Set(attackRange.map(([x, y]) => `${x},${y}`));
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);

  const isUnitOnCooldown = (id: string) => {
    const cd = unitCooldowns[id];
    return cd !== undefined && now < cd;
  };

  const getCooldownSecs = (id: string) => {
    const cd = unitCooldowns[id];
    if (!cd || now >= cd) return 0;
    return Math.ceil((cd - now) / 1000);
  };

  // ── Dying unit tracking ──────────────────────────────────────────────────
  const [dyingUnits, setDyingUnits] = useState<Map<string, DyingEntry>>(new Map);
  const prevUnitsRef = useRef<Map<string, { unit: Unit; gx: number; gy: number; h: number }>>(new Map());

  useEffect(() => {
    const currentUnitIds = new Set<string>();
    for (const row of grid)
      for (const tile of row)
        if (tile.unit) currentUnitIds.add(tile.unit.id);

    const newDying = new Map<string, DyingEntry>();
    prevUnitsRef.current.forEach((entry, id) => {
      if (!currentUnitIds.has(id) && !dyingUnits.has(id)) {
        newDying.set(id, { ...entry, startTime: performance.now() });
      }
    });

    if (newDying.size > 0) {
      setDyingUnits(prev => new Map([...prev, ...newDying]));
    }

    // Update prev snapshot
    const snapshot = new Map<string, { unit: Unit; gx: number; gy: number; h: number }>();
    for (const row of grid)
      for (const tile of row)
        if (tile.unit) {
          const [gx, gy] = tile.position;
          snapshot.set(tile.unit.id, { unit: tile.unit, gx, gy, h: TERRAIN_HEIGHT[tile.terrain.type] });
        }
    prevUnitsRef.current = snapshot;
  }, [grid]);

  const removeDyingUnit = (id: string) => {
    setDyingUnits(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
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
              isHovered={hoveredTile === key}
              isUnitOnCooldown={onCd}
              cooldownSecs={cdSecs}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onTileClick(tx, ty, e.nativeEvent.clientX, e.nativeEvent.clientY);
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHoveredTile(key);
              }}
              onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHoveredTile(prev => prev === key ? null : prev);
              }}
            />
          );
        })
      )}

      {/* Dying unit animations */}
      {[...dyingUnits.values()].map(entry => (
        <DyingUnit key={entry.unit.id} entry={entry} onDone={removeDyingUnit} />
      ))}

      {/* Attack animations */}
      {attackEvent && (() => {
        const [ax, ay] = attackEvent.attackerPos;
        const [dx, dy] = attackEvent.defenderPos;
        const attackerTile = grid[ay]?.[ax];
        const defenderTile = grid[dy]?.[dx];
        if (!attackerTile || !defenderTile) return null;
        const ah = TERRAIN_HEIGHT[attackerTile.terrain.type];
        const dh = TERRAIN_HEIGHT[defenderTile.terrain.type];
        return (
          <>
            {/* Initial attack projectile */}
            <Projectile
              key={attackEvent.timestamp}
              attackerPos={attackEvent.attackerPos}
              defenderPos={attackEvent.defenderPos}
              ah={ah}
              dh={dh}
              startTime={attackEvent.timestamp}
            />
            <ImpactFlash
              key={`flash-${attackEvent.timestamp}`}
              defenderPos={attackEvent.defenderPos}
              h={dh}
              startTime={attackEvent.timestamp}
              delay={PROJECTILE_DURATION - 30}
            />
            {/* Counter-attack projectile — fires after first ball lands */}
            {attackEvent.hasCounter && (
              <>
                <Projectile
                  key={`counter-${attackEvent.timestamp}`}
                  attackerPos={attackEvent.defenderPos}
                  defenderPos={attackEvent.attackerPos}
                  ah={dh}
                  dh={ah}
                  startTime={attackEvent.timestamp + PROJECTILE_DURATION}
                />
                <ImpactFlash
                  key={`counter-flash-${attackEvent.timestamp}`}
                  defenderPos={attackEvent.attackerPos}
                  h={ah}
                  startTime={attackEvent.timestamp + PROJECTILE_DURATION}
                  delay={PROJECTILE_DURATION - 30}
                />
              </>
            )}
          </>
        );
      })()}
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
  attackEvent: { attackerPos: [number, number]; defenderPos: [number, number]; timestamp: number; hasCounter: boolean } | null;
}

export default function GameBoard3D(props: GameBoard3DProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!props.grid.length) return null;

  return (
    <div ref={canvasRef} style={{ width: '100%', height: '100%', minHeight: 420, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
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
