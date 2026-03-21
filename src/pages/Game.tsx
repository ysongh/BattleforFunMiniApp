import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { UnitType, TerrainType, Player, City, Terrain, Unit, Tile } from '../types/game';
import {
  IconSword,
  IconShield,
  IconTarget,
  IconChevronUp,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconPlayerTrackNext,
  IconRobot,
  IconClock,
  IconBolt,
  IconBuildingFactory,
} from '@tabler/icons-react';

// Game constants
const GRID_SIZE = 10;
const COOLDOWN_DURATION = 10000; // 10 seconds
const AP_REGEN_INTERVAL = 20000; // 1 AP every 20 seconds
const AI_ACTION_INTERVAL = 3000; // AI tries to act every 3 seconds
const MAX_AP = 10;

const UNIT_COSTS: Record<UnitType, number> = {
  Infantry: 100,
  Tank: 300,
  Artillery: 250,
};

const UNIT_TYPES: Record<UnitType, Omit<Unit, 'id' | 'position' | 'player'>> = {
  Infantry: {
    type: 'Infantry',
    health: 100,
    attack: 55,
    defense: 10,
    moveRange: 3,
    attackRange: 1,
  },
  Tank: {
    type: 'Tank',
    health: 100,
    attack: 75,
    defense: 30,
    moveRange: 5,
    attackRange: 1,
  },
  Artillery: {
    type: 'Artillery',
    health: 100,
    attack: 90,
    defense: 5,
    moveRange: 3,
    attackRange: 3,
  },
};

const TERRAIN_TYPES: Record<TerrainType, Terrain> = {
  Plain: { type: 'Plain', defenseBonus: 0, movementCost: 1 },
  Mountain: { type: 'Mountain', defenseBonus: 30, movementCost: 3 },
  Forest: { type: 'Forest', defenseBonus: 10, movementCost: 2 },
  City: {
    type: 'City',
    defenseBonus: 20,
    movementCost: 1,
    isCity: true,
  },
  Road: { type: 'Road', defenseBonus: 0, movementCost: 0.5 },
};

// Helper functions
const generateId = () => Math.random().toString(36).substring(2, 9);

const createUnit = (type: UnitType, position: [number, number], player: Player): Unit => ({
  id: generateId(),
  position,
  player,
  ...UNIT_TYPES[type],
});

const getTerrainColor = (terrain: TerrainType): string => {
  switch (terrain) {
    case 'Plain': return 'bg-green-200';
    case 'Mountain': return 'bg-gray-500';
    case 'Forest': return 'bg-green-600';
    case 'City': return 'bg-yellow-200';
    case 'Road': return 'bg-yellow-600';
    default: return 'bg-green-200';
  }
};

const getUnitColor = (player: Player): string => {
  return player === 'Red' ? 'bg-red-500' : 'bg-blue-500';
};

const getUnitIcon = (type: UnitType) => {
  switch (type) {
    case 'Infantry': return <IconSword size={16} stroke={2.5} color="white" />;
    case 'Tank': return <IconShield size={16} stroke={2.5} color="white" />;
    case 'Artillery': return <IconTarget size={16} stroke={2.5} color="white" />;
  }
};

const generateInitialGrid = (): Tile[][] => {
  const grid: Tile[][] = [];
  const terrainTypes = Object.keys(TERRAIN_TYPES) as TerrainType[];

  for (let y = 0; y < GRID_SIZE; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const randomTerrainIndex = Math.floor(Math.random() * terrainTypes.length);
      grid[y][x] = {
        position: [x, y],
        terrain: TERRAIN_TYPES[terrainTypes[randomTerrainIndex]],
        unit: null,
      };
    }
  }

  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.Mountain;
  }

  for (let i = 0; i < 40; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.Forest;
  }

  for (let i = 0; i < 15; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.City;
  }

  for (let i = 0; i < 3; i++) {
    const startX = Math.floor(Math.random() * GRID_SIZE);
    let x = startX;
    for (let y = 0; y < GRID_SIZE; y++) {
      grid[y][x].terrain = TERRAIN_TYPES.Road;
      if (Math.random() > 0.7 && x > 0 && x < GRID_SIZE - 1) {
        x += Math.random() > 0.5 ? 1 : -1;
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    const startY = Math.floor(Math.random() * GRID_SIZE);
    let y = startY;
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[y][x].terrain = TERRAIN_TYPES.Road;
      if (Math.random() > 0.7 && y > 0 && y < GRID_SIZE - 1) {
        y += Math.random() > 0.5 ? 1 : -1;
      }
    }
  }

  return grid;
};

const calculateDamage = (attacker: Unit, defender: Unit, defenderTerrain: Terrain): number => {
  const terrainDefense = defender.defense * (defenderTerrain.defenseBonus / 100);
  const damage = Math.max(0, attacker.attack - (defender.defense + terrainDefense));
  return Math.min(defender.health, Math.max(10, damage));
};

const Game = () => {
  const location = useLocation();
  const lobbyState = location.state as { isAIEnabled?: boolean; aiDifficulty?: 'easy' | 'medium' | 'hard' } | null;

  const [grid, setGrid] = useState<Tile[][]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [movementRange, setMovementRange] = useState<[number, number][]>([]);
  const [attackRange, setAttackRange] = useState<[number, number][]>([]);
  const [gameStatus, setGameStatus] = useState<string>('Select a unit to act');
  const [viewportPosition, setViewportPosition] = useState<[number, number]>([0, 0]);
  const [viewSize] = useState<number>(10);
  const [resources, setResources] = useState<Record<Player, number>>({ Red: 1000, Blue: 1000 });

  // AP & Cooldown state
  const [actionPoints, setActionPoints] = useState<Record<Player, number>>({ Red: 5, Blue: 5 });
  const [unitCooldowns, setUnitCooldowns] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  // Action menu state: shown after moving near enemies or onto a capturable city
  // canCapture: true if Infantry on a capturable city
  // enemies: attackable enemy units nearby
  const [actionMenu, setActionMenu] = useState<{
    unit: Unit; x: number; y: number; justMoved: boolean;
    canCapture: boolean;
    enemies: { unit: Unit; x: number; y: number }[];
  } | null>(null);

  // Factory menu state: shown when clicking an owned city with no unit
  const [factoryMenu, setFactoryMenu] = useState<{ x: number; y: number } | null>(null);

  // AI state
  const [isAIEnabled, setIsAIEnabled] = useState(lobbyState?.isAIEnabled ?? false);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>(lobbyState?.aiDifficulty ?? 'medium');

  // Refs for use inside intervals (avoids stale closures)
  const gridRef = useRef<Tile[][]>([]);
  const apRef = useRef(actionPoints);
  const cooldownsRef = useRef(unitCooldowns);
  const aiDifficultyRef = useRef(aiDifficulty);
  const gameOverRef = useRef(false);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { apRef.current = actionPoints; }, [actionPoints]);
  useEffect(() => { cooldownsRef.current = unitCooldowns; }, [unitCooldowns]);
  useEffect(() => { aiDifficultyRef.current = aiDifficulty; }, [aiDifficulty]);

  // Update clock every second for cooldown display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // AP regeneration: +1 AP every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameOverRef.current) return;
      setActionPoints(prev => ({
        Red: Math.min(MAX_AP, prev.Red + 1),
        Blue: Math.min(MAX_AP, prev.Blue + 1),
      }));
    }, AP_REGEN_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Initialize game
  useEffect(() => { initializeGame(); }, []);

  // AI action interval
  const tryAIAction = useCallback(() => {
    if (gameOverRef.current) return;
    const currentGrid = gridRef.current;
    const currentAP = apRef.current;
    const currentCooldowns = cooldownsRef.current;
    const currentTime = Date.now();
    const difficulty = aiDifficultyRef.current;

    if (currentAP.Blue <= 0 || currentGrid.length === 0) return;

    // Find available Blue units (not on cooldown)
    const available: { unit: Unit; x: number; y: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const unit = currentGrid[y][x].unit;
        if (unit?.player === 'Blue') {
          const cd = currentCooldowns[unit.id];
          if (!cd || currentTime >= cd) {
            available.push({ unit, x, y });
          }
        }
      }
    }
    if (available.length === 0) return;

    // Find all Red units
    const redUnits: { unit: Unit; x: number; y: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const unit = currentGrid[y][x].unit;
        if (unit?.player === 'Red') redUnits.push({ unit, x, y });
      }
    }
    if (redUnits.length === 0) return;

    // Pick a unit — prefer those that can attack
    let chosen: { unit: Unit; x: number; y: number };
    const canAttack = available.filter(({ unit, x, y }) =>
      unit.attackRange > 0 && redUnits.some(red => {
        const dist = Math.abs(red.x - x) + Math.abs(red.y - y);
        return dist <= unit.attackRange;
      })
    );

    if (difficulty === 'easy') {
      chosen = available[Math.floor(Math.random() * available.length)];
    } else if (canAttack.length > 0) {
      chosen = canAttack[Math.floor(Math.random() * canAttack.length)];
    } else {
      chosen = available[Math.floor(Math.random() * available.length)];
    }

    const { unit, x: ux, y: uy } = chosen;

    // Deep copy grid for modification
    const newGrid: Tile[][] = currentGrid.map(row =>
      row.map(tile => ({
        ...tile,
        unit: tile.unit ? { ...tile.unit } : null,
        terrain: { ...tile.terrain },
      }))
    );

    // Try to attack first
    const attackTargets = redUnits.filter(red => {
      const dist = Math.abs(red.x - ux) + Math.abs(red.y - uy);
      return dist <= unit.attackRange;
    });

    if (attackTargets.length > 0 && unit.attackRange > 0) {
      let target: typeof attackTargets[0];
      if (difficulty === 'easy') {
        target = attackTargets[Math.floor(Math.random() * attackTargets.length)];
      } else if (difficulty === 'hard') {
        target = attackTargets.reduce((best, t) => {
          const dmg = calculateDamage(unit, t.unit, currentGrid[t.y][t.x].terrain);
          const bestDmg = calculateDamage(unit, best.unit, currentGrid[best.y][best.x].terrain);
          const tScore = t.unit.health <= dmg ? 10000 : 1000 - t.unit.health;
          const bestScore = best.unit.health <= bestDmg ? 10000 : 1000 - best.unit.health;
          return tScore > bestScore ? t : best;
        });
      } else {
        target = attackTargets.reduce((w, t) => t.unit.health < w.unit.health ? t : w);
      }

      const damage = calculateDamage(unit, target.unit, newGrid[target.y][target.x].terrain);
      const newHealth = target.unit.health - damage;
      if (newHealth <= 0) {
        newGrid[target.y][target.x].unit = null;
      } else {
        newGrid[target.y][target.x].unit = { ...target.unit, health: newHealth };
      }

      setGrid(newGrid);
      setActionPoints(prev => ({ ...prev, Blue: prev.Blue - 1 }));
      setUnitCooldowns(prev => ({ ...prev, [unit.id]: Date.now() + COOLDOWN_DURATION }));
      setGameStatus(`AI ${unit.type} attacked!`);

      // Check win
      let redCount = 0;
      for (let y2 = 0; y2 < GRID_SIZE; y2++)
        for (let x2 = 0; x2 < GRID_SIZE; x2++)
          if (newGrid[y2]?.[x2]?.unit?.player === 'Red') redCount++;
      if (redCount === 0) {
        setGameStatus('Blue wins!');
        gameOverRef.current = true;
      }
      return;
    }

    // No attack possible — move toward nearest enemy
    const nearestEnemy = redUnits.reduce((nearest, red) => {
      const dist = Math.abs(red.x - ux) + Math.abs(red.y - uy);
      const nearestDist = Math.abs(nearest.x - ux) + Math.abs(nearest.y - uy);
      return dist < nearestDist ? red : nearest;
    });

    // Find valid moves (simple Manhattan for AI)
    const validMoves: [number, number][] = [];
    for (let dx = -unit.moveRange; dx <= unit.moveRange; dx++) {
      for (let dy = -unit.moveRange; dy <= unit.moveRange; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > unit.moveRange) continue;
        const nx = ux + dx, ny = uy + dy;
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        if (nx === ux && ny === uy) continue;
        if (newGrid[ny][nx].unit !== null) continue;
        validMoves.push([nx, ny]);
      }
    }

    if (validMoves.length === 0) return;

    let bestPos: [number, number];
    if (difficulty === 'easy') {
      bestPos = validMoves[Math.floor(Math.random() * validMoves.length)];
    } else {
      bestPos = validMoves.reduce((best, [nx, ny]) => {
        const dist = Math.abs(nx - nearestEnemy.x) + Math.abs(ny - nearestEnemy.y);
        const bestDist = Math.abs(best[0] - nearestEnemy.x) + Math.abs(best[1] - nearestEnemy.y);
        return dist < bestDist ? [nx, ny] as [number, number] : best;
      });
    }

    newGrid[uy][ux].unit = null;
    newGrid[bestPos[1]][bestPos[0]].unit = { ...unit, position: bestPos };

    setGrid(newGrid);
    setActionPoints(prev => ({ ...prev, Blue: prev.Blue - 1 }));
    setUnitCooldowns(prev => ({ ...prev, [unit.id]: Date.now() + COOLDOWN_DURATION }));
    setGameStatus(`AI ${unit.type} moved`);
  }, []);

  useEffect(() => {
    if (!isAIEnabled) return;
    const interval = setInterval(tryAIAction, AI_ACTION_INTERVAL);
    return () => clearInterval(interval);
  }, [isAIEnabled, tryAIAction]);

  const initializeGame = () => {
    const initialGrid = generateInitialGrid();

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (initialGrid[y][x].terrain.type === 'City') {
          initialGrid[y][x].terrain = {
            ...initialGrid[y][x].terrain,
            owner: null,
            captureProgress: 0,
          } as City;
        }
      }
    }

    let redCityAssigned = false;
    let blueCityAssigned = false;

    for (let y = 0; y < GRID_SIZE && (!redCityAssigned || !blueCityAssigned); y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const terrain = initialGrid[y][x].terrain;
        if (terrain.type === 'City') {
          if (!redCityAssigned && y < 3) {
            (terrain as City).owner = 'Red';
            redCityAssigned = true;
          } else if (!blueCityAssigned && y >= GRID_SIZE - 3) {
            (terrain as City).owner = 'Blue';
            blueCityAssigned = true;
          }
        }
        if (redCityAssigned && blueCityAssigned) break;
      }
    }

    initialGrid[1][2].unit = createUnit('Infantry', [2, 1], 'Red');
    initialGrid[2][1].unit = createUnit('Tank', [1, 2], 'Red');
    initialGrid[3][2].unit = createUnit('Artillery', [2, 3], 'Red');
    initialGrid[1][4].unit = createUnit('Infantry', [4, 1], 'Red');
    initialGrid[2][5].unit = createUnit('Infantry', [5, 2], 'Red');

    initialGrid[GRID_SIZE - 2][GRID_SIZE - 3].unit = createUnit('Infantry', [GRID_SIZE - 3, GRID_SIZE - 2], 'Blue');
    initialGrid[GRID_SIZE - 3][GRID_SIZE - 2].unit = createUnit('Tank', [GRID_SIZE - 2, GRID_SIZE - 3], 'Blue');
    initialGrid[GRID_SIZE - 4][GRID_SIZE - 3].unit = createUnit('Artillery', [GRID_SIZE - 3, GRID_SIZE - 4], 'Blue');
    initialGrid[GRID_SIZE - 2][GRID_SIZE - 5].unit = createUnit('Infantry', [GRID_SIZE - 5, GRID_SIZE - 2], 'Blue');
    initialGrid[GRID_SIZE - 3][GRID_SIZE - 6].unit = createUnit('Infantry', [GRID_SIZE - 6, GRID_SIZE - 3], 'Blue');

    setGrid(initialGrid);
    gameOverRef.current = false;
  };

  // --- Cooldown helpers ---

  const isUnitOnCooldown = (unitId: string): boolean => {
    const cd = unitCooldowns[unitId];
    return cd !== undefined && now < cd;
  };

  const getCooldownRemaining = (unitId: string): number => {
    const cd = unitCooldowns[unitId];
    if (!cd || now >= cd) return 0;
    return Math.ceil((cd - now) / 1000);
  };


  // --- Movement range (Dijkstra) ---

  const calculateMovementRange = (unit: Unit): [number, number][] => {
    const [startX, startY] = unit.position;
    const budget = unit.moveRange;

    const costMap = new Map<string, number>();
    const queue: { x: number; y: number; cost: number }[] = [];
    const validMovesSet = new Set<string>();

    costMap.set(`${startX},${startY}`, 0);
    queue.push({ x: startX, y: startY, cost: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const { x, y, cost } = queue.shift()!;

      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;

        const tile = grid[ny][nx];
        const newCost = cost + tile.terrain.movementCost;
        if (newCost > budget) continue;

        const key = `${nx},${ny}`;
        const best = costMap.get(key);
        if (best !== undefined && best <= newCost) continue;
        costMap.set(key, newCost);

        const occupant = tile.unit;
        if (occupant === null) {
          validMovesSet.add(key);
          queue.push({ x: nx, y: ny, cost: newCost });
        } else if (occupant.player === unit.player) {
          queue.push({ x: nx, y: ny, cost: newCost });
        }
      }
    }

    return [...validMovesSet].map(key => {
      const [kx, ky] = key.split(',').map(Number);
      return [kx, ky] as [number, number];
    });
  };

  const calculateAttackRange = (unit: Unit): [number, number][] => {
    const [x, y] = unit.position;
    const range = unit.attackRange;
    const validAttacks: [number, number][] = [];

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        if (grid[ny][nx].unit === null || grid[ny][nx].unit?.player === unit.player) continue;
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= range) {
          validAttacks.push([nx, ny]);
        }
      }
    }

    return validAttacks;
  };

  // Find enemy units within attack range from a given position
  const findEnemiesInRange = (unit: Unit, ux: number, uy: number): { unit: Unit; x: number; y: number }[] => {
    const enemies: { unit: Unit; x: number; y: number }[] = [];
    if (unit.attackRange <= 0) return enemies;
    for (let dy = -unit.attackRange; dy <= unit.attackRange; dy++) {
      for (let dx = -unit.attackRange; dx <= unit.attackRange; dx++) {
        const nx = ux + dx, ny = uy + dy;
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        if (Math.abs(dx) + Math.abs(dy) > unit.attackRange) continue;
        const target = grid[ny]?.[nx]?.unit;
        if (target && target.player !== unit.player) {
          enemies.push({ unit: target, x: nx, y: ny });
        }
      }
    }
    return enemies;
  };

  // --- Selection & interaction ---

  const handleUnitSelect = (x: number, y: number) => {
    const unit = grid[y][x].unit;

    if (!unit) {
      setSelectedUnit(null);
      setMovementRange([]);
      setAttackRange([]);
      return;
    }

    if (unit.player !== 'Red') {
      setGameStatus('You can only control Red units');
      return;
    }

    if (isUnitOnCooldown(unit.id)) {
      setGameStatus(`Cooldown: ${getCooldownRemaining(unit.id)}s remaining`);
      return;
    }

    if (actionPoints.Red <= 0) {
      setGameStatus('No AP! Wait for regeneration');
      return;
    }

    setSelectedUnit(unit);
    centerViewportOn(x, y);

    // Check for nearby actions: capture or attack
    const tile = grid[y][x];
    const canCapture = unit.type === 'Infantry' && !!tile.terrain.isCity &&
      (!((tile.terrain as City).owner) || (tile.terrain as City).owner !== unit.player);
    const nearbyEnemies = findEnemiesInRange(unit, x, y);

    if (canCapture || nearbyEnemies.length > 0) {
      setActionMenu({ unit, x, y, justMoved: false, canCapture, enemies: nearbyEnemies });
      setGameStatus(canCapture ? 'Capture, attack, or continue?' : 'Attack or continue?');
      return;
    }

    const moveRange = calculateMovementRange(unit);
    setMovementRange(moveRange);

    const atkRange = calculateAttackRange(unit);
    setAttackRange(atkRange);

    if (moveRange.length > 0 || atkRange.length > 0) {
      setGameStatus('Move or attack (each costs 1 AP)');
    } else {
      setGameStatus('No valid moves or attacks');
    }
  };

  const handleTileClick = (x: number, y: number) => {
    if (actionMenu) return; // Block interaction while capture menu is open
    if (factoryMenu) { setFactoryMenu(null); return; } // Close factory menu on outside click

    if (!selectedUnit) {
      // Check if clicking an owned empty city → open factory
      const tile = grid[y]?.[x];
      if (tile && tile.terrain.isCity && !tile.unit) {
        const city = tile.terrain as City;
        if (city.owner === 'Red') {
          setFactoryMenu({ x, y });
          setGameStatus('Select a unit to produce');
          return;
        }
      }

      if (grid[y][x].unit?.player === 'Red') {
        handleUnitSelect(x, y);
      }
      return;
    }

    // Movement
    if (movementRange.some(([mx, my]) => mx === x && my === y)) {
      moveUnit(selectedUnit, x, y);
      return;
    }

    // Attack
    if (attackRange.some(([ax, ay]) => ax === x && ay === y)) {
      attackUnit(selectedUnit, x, y);
      return;
    }

    // Select another Red unit
    if (grid[y][x].unit?.player === 'Red') {
      handleUnitSelect(x, y);
      return;
    }

    // Deselect
    setSelectedUnit(null);
    setMovementRange([]);
    setAttackRange([]);
  };

  // --- Move (costs 1 AP, starts cooldown) ---

  const moveUnit = (unit: Unit, x: number, y: number) => {
    if (actionPoints.Red <= 0) {
      setGameStatus('No AP!');
      return;
    }

    const updatedGrid = [...grid];
    const [oldX, oldY] = unit.position;
    updatedGrid[oldY][oldX].unit = null;

    // Reset city capture progress if moving away
    const oldTile = grid[oldY][oldX];
    if (oldTile.terrain.isCity) {
      const city = oldTile.terrain as City;
      if (city.owner !== unit.player && city.captureProgress > 0) {
        city.captureProgress = 0;
        updatedGrid[oldY][oldX].terrain = city;
      }
    }

    const updatedUnit = { ...unit, position: [x, y] as [number, number] };
    updatedGrid[y][x].unit = updatedUnit;

    setGrid(updatedGrid);
    setActionPoints(prev => ({ ...prev, Red: prev.Red - 1 }));
    setSelectedUnit(null);
    setMovementRange([]);
    setAttackRange([]);
    centerViewportOn(x, y);

    // Check for actions after moving: capture city or attack nearby enemies
    const destTile = updatedGrid[y][x];
    const canCapture = updatedUnit.type === 'Infantry' && !!destTile.terrain.isCity &&
      (!(destTile.terrain as City).owner || (destTile.terrain as City).owner !== updatedUnit.player);

    // Find enemies in attack range from new position (use updatedGrid)
    const nearbyEnemies: { unit: Unit; x: number; y: number }[] = [];
    if (updatedUnit.attackRange > 0) {
      for (let dy = -updatedUnit.attackRange; dy <= updatedUnit.attackRange; dy++) {
        for (let dx = -updatedUnit.attackRange; dx <= updatedUnit.attackRange; dx++) {
          const nx = x + dx, ny2 = y + dy;
          if (nx < 0 || nx >= GRID_SIZE || ny2 < 0 || ny2 >= GRID_SIZE) continue;
          if (Math.abs(dx) + Math.abs(dy) > updatedUnit.attackRange) continue;
          const target = updatedGrid[ny2]?.[nx]?.unit;
          if (target && target.player !== updatedUnit.player) {
            nearbyEnemies.push({ unit: target, x: nx, y: ny2 });
          }
        }
      }
    }

    if (canCapture || nearbyEnemies.length > 0) {
      setActionMenu({ unit: updatedUnit, x, y, justMoved: true, canCapture, enemies: nearbyEnemies });
      setGameStatus(canCapture && nearbyEnemies.length > 0
        ? 'Capture, attack, or wait?'
        : canCapture ? 'Capture or wait?' : 'Attack or wait?');
      return;
    }

    // No actions available — start cooldown
    setUnitCooldowns(prev => ({ ...prev, [unit.id]: Date.now() + COOLDOWN_DURATION }));
    setGameStatus(`${unit.type} moved`);
  };

  // --- Capture menu handlers ---

  const handleCapture = () => {
    if (!actionMenu) return;
    const { unit, x, y } = actionMenu;

    if (actionPoints.Red <= 0) {
      setGameStatus('No AP to capture! Wait for regeneration');
      return;
    }

    const updatedGrid = [...grid];
    const city = updatedGrid[y][x].terrain as City;

    // Reset progress if switching ownership
    if (city.owner && city.owner !== unit.player) {
      city.captureProgress = 0;
    }

    const captureAmount = Math.floor(unit.health / 10);
    city.captureProgress += captureAmount;

    if (city.captureProgress >= 20) {
      city.owner = unit.player;
      city.captureProgress = 0;
      setGameStatus(`${unit.player} captured a city!`);
    } else {
      setGameStatus(`Capturing: ${city.captureProgress}/20`);
    }

    updatedGrid[y][x].terrain = city;
    setGrid(updatedGrid);
    setActionPoints(prev => ({ ...prev, Red: prev.Red - 1 }));
    setUnitCooldowns(prev => ({ ...prev, [unit.id]: Date.now() + COOLDOWN_DURATION }));
    setActionMenu(null);
  };

  // --- Factory: buy units on owned cities ---

  const handleBuyUnit = (unitType: UnitType) => {
    if (!factoryMenu) return;
    const { x, y } = factoryMenu;
    const cost = UNIT_COSTS[unitType];

    if (resources.Red < cost) {
      setGameStatus(`Not enough funds! Need $${cost}`);
      return;
    }

    if (actionPoints.Red <= 0) {
      setGameStatus('No AP to produce unit!');
      return;
    }

    const updatedGrid = [...grid];
    const newUnit = createUnit(unitType, [x, y], 'Red');
    updatedGrid[y][x].unit = newUnit;

    setGrid(updatedGrid);
    setResources(prev => ({ ...prev, Red: prev.Red - cost }));
    setActionPoints(prev => ({ ...prev, Red: prev.Red - 1 }));
    setUnitCooldowns(prev => ({ ...prev, [newUnit.id]: Date.now() + COOLDOWN_DURATION }));
    setFactoryMenu(null);
    setGameStatus(`Produced ${unitType} for $${cost}`);
  };

  const handleWait = () => {
    if (!actionMenu) return;
    const { unit, justMoved } = actionMenu;
    setActionMenu(null);

    if (justMoved) {
      // Unit already spent AP on movement — start cooldown
      setUnitCooldowns(prev => ({ ...prev, [unit.id]: Date.now() + COOLDOWN_DURATION }));
      setGameStatus(`${unit.type} is waiting`);
    } else {
      // Unit was already here — show move/attack options instead
      const moveRange = calculateMovementRange(unit);
      const atkRange = calculateAttackRange(unit);
      setSelectedUnit(unit);
      setMovementRange(moveRange);
      setAttackRange(atkRange);
      setGameStatus('Move or attack (each costs 1 AP)');
    }
  };

  const handleAttackFromMenu = (enemyX: number, enemyY: number) => {
    if (!actionMenu) return;
    const { unit, justMoved } = actionMenu;

    if (actionPoints.Red <= 0) {
      setGameStatus('No AP to attack!');
      return;
    }

    const updatedGrid = [...grid];
    const defender = updatedGrid[enemyY][enemyX].unit!;
    const terrain = updatedGrid[enemyY][enemyX].terrain;
    const damage = calculateDamage(unit, defender, terrain);
    const updatedDefender = { ...defender, health: defender.health - damage };

    if (updatedDefender.health <= 0) {
      updatedGrid[enemyY][enemyX].unit = null;
      setGameStatus(`${defender.type} destroyed!`);
    } else {
      updatedGrid[enemyY][enemyX].unit = updatedDefender;
      setGameStatus(`${defender.type} took ${damage} damage!`);
    }

    setGrid(updatedGrid);
    // Only deduct AP if the unit didn't already spend AP on moving
    if (!justMoved) {
      setActionPoints(prev => ({ ...prev, Red: prev.Red - 1 }));
    }
    setUnitCooldowns(prev => ({ ...prev, [unit.id]: Date.now() + COOLDOWN_DURATION }));
    setActionMenu(null);

    // Check win condition
    let blueCount = 0;
    for (let cy = 0; cy < GRID_SIZE; cy++)
      for (let cx = 0; cx < GRID_SIZE; cx++)
        if (updatedGrid[cy]?.[cx]?.unit?.player === 'Blue') blueCount++;
    if (blueCount === 0) {
      setGameStatus('Red wins!');
      gameOverRef.current = true;
    }
  };

  // --- Attack (costs 1 AP, starts cooldown) ---

  const attackUnit = (attacker: Unit, x: number, y: number) => {
    if (actionPoints.Red <= 0) {
      setGameStatus('No AP!');
      return;
    }

    const updatedGrid = [...grid];
    const defender = grid[y][x].unit!;
    const terrain = grid[y][x].terrain;
    const damage = calculateDamage(attacker, defender, terrain);
    const updatedDefender = { ...defender, health: defender.health - damage };

    if (updatedDefender.health <= 0) {
      updatedGrid[y][x].unit = null;
      setGameStatus(`${defender.type} destroyed!`);
    } else {
      updatedGrid[y][x].unit = updatedDefender;
      setGameStatus(`${defender.type} took ${damage} damage!`);
    }

    setGrid(updatedGrid);
    setActionPoints(prev => ({ ...prev, Red: prev.Red - 1 }));
    setUnitCooldowns(prev => ({ ...prev, [attacker.id]: Date.now() + COOLDOWN_DURATION }));
    setSelectedUnit(null);
    setMovementRange([]);
    setAttackRange([]);

    // Check win condition
    let blueCount = 0;
    for (let cy = 0; cy < GRID_SIZE; cy++)
      for (let cx = 0; cx < GRID_SIZE; cx++)
        if (updatedGrid[cy]?.[cx]?.unit?.player === 'Blue') blueCount++;

    if (blueCount === 0) {
      setGameStatus('Red wins!');
      gameOverRef.current = true;
    }
  };

  // --- Viewport & navigation ---

  const getCityOwnerColor = (city: City): string => {
    if (!city.owner) return 'border-gray-600';
    return city.owner === 'Red' ? 'border-red-600' : 'border-blue-600';
  };

  const isInMovementRange = (x: number, y: number): boolean =>
    movementRange.some(([mx, my]) => mx === x && my === y);

  const isInAttackRange = (x: number, y: number): boolean =>
    attackRange.some(([ax, ay]) => ax === x && ay === y);

  const moveViewport = (dx: number, dy: number) => {
    const [x, y] = viewportPosition;
    setViewportPosition([
      Math.max(0, Math.min(GRID_SIZE - viewSize, x + dx)),
      Math.max(0, Math.min(GRID_SIZE - viewSize, y + dy)),
    ]);
  };

  const centerViewportOn = (x: number, y: number) => {
    const half = Math.floor(viewSize / 2);
    setViewportPosition([
      Math.max(0, Math.min(GRID_SIZE - viewSize, x - half)),
      Math.max(0, Math.min(GRID_SIZE - viewSize, y - half)),
    ]);
  };

  const visibleGrid = () => {
    const [viewX, viewY] = viewportPosition;
    const viewGrid: Tile[][] = [];
    for (let y = viewY; y < Math.min(GRID_SIZE, viewY + viewSize); y++) {
      const row: Tile[] = [];
      for (let x = viewX; x < Math.min(GRID_SIZE, viewX + viewSize); x++) {
        if (grid[y] && grid[y][x]) row.push(grid[y][x]);
      }
      viewGrid.push(row);
    }
    return viewGrid;
  };

  const findRedUnits = (): [number, number][] => {
    const units: [number, number][] = [];
    for (let y = 0; y < GRID_SIZE; y++)
      for (let x = 0; x < GRID_SIZE; x++)
        if (grid[y]?.[x]?.unit?.player === 'Red') units.push([x, y]);
    return units;
  };

  const cycleToNextUnit = () => {
    const units = findRedUnits().filter(([x, y]) => {
      const unit = grid[y][x].unit!;
      return !isUnitOnCooldown(unit.id);
    });
    if (units.length === 0) return;

    let nextIndex = 0;
    if (selectedUnit) {
      const [sx, sy] = selectedUnit.position;
      const curIdx = units.findIndex(([x, y]) => x === sx && y === sy);
      if (curIdx !== -1) nextIndex = (curIdx + 1) % units.length;
    }

    const [x, y] = units[nextIndex];
    handleUnitSelect(x, y);
  };

  // --- Render ---

  return (
    <div className="flex flex-col items-center p-2 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-2">Battle for Fun</h1>

      <div className="flex flex-wrap gap-2 mb-2 justify-center">
        {/* Status & AP panel */}
        <div className="bg-white p-2 rounded shadow">
          <p className="text-sm mb-1">{gameStatus}</p>
          <div className="flex gap-4 mb-2">
            <p className="text-red-600 font-bold">Red: ${resources.Red}</p>
            <p className="text-blue-600 font-bold">Blue: ${resources.Blue}</p>
          </div>

          {/* AP Display */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <IconBolt size={14} className="text-red-600" />
              <span className="text-xs font-semibold text-red-600">Red:</span>
              <div className="flex gap-0.5">
                {Array.from({ length: MAX_AP }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-sm ${i < actionPoints.Red ? 'bg-red-500' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-red-600">{actionPoints.Red}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconBolt size={14} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-600">Blue:</span>
              <div className="flex gap-0.5">
                {Array.from({ length: MAX_AP }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-sm ${i < actionPoints.Blue ? 'bg-blue-500' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-blue-600">{actionPoints.Blue}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
              onClick={cycleToNextUnit}
            >
              <IconPlayerTrackNext size={14} /> Next Unit
            </button>
          </div>

          {/* AI Controls */}
          <div className="mt-2 border-t pt-2">
            <div className="flex items-center gap-2 mb-1">
              <IconRobot size={14} className="text-gray-600" />
              <span className="text-xs font-semibold">AI (Blue):</span>
              <button
                className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${isAIEnabled ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setIsAIEnabled(v => !v)}
              >
                {isAIEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {isAIEnabled && (
              <div className="flex gap-1">
                {(['easy', 'medium', 'hard'] as const).map(level => (
                  <button
                    key={level}
                    className={`px-2 py-0.5 text-xs rounded capitalize ${aiDifficulty === level ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
                    onClick={() => setAiDifficulty(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white p-2 rounded shadow">
          <h3 className="text-sm font-semibold mb-1">Navigation:</h3>
          <div className="grid grid-cols-3 gap-1">
            <div></div>
            <button className="bg-gray-200 hover:bg-gray-300 p-1 rounded flex items-center justify-center" onClick={() => moveViewport(0, -1)}><IconChevronUp size={16} /></button>
            <div></div>
            <button className="bg-gray-200 hover:bg-gray-300 p-1 rounded flex items-center justify-center" onClick={() => moveViewport(-1, 0)}><IconChevronLeft size={16} /></button>
            <button
              className="bg-gray-200 hover:bg-gray-300 p-1 rounded flex items-center justify-center"
              onClick={() => {
                const units = findRedUnits();
                if (units.length > 0) centerViewportOn(units[0][0], units[0][1]);
              }}
            ><IconHome size={16} /></button>
            <button className="bg-gray-200 hover:bg-gray-300 p-1 rounded flex items-center justify-center" onClick={() => moveViewport(1, 0)}><IconChevronRight size={16} /></button>
            <div></div>
            <button className="bg-gray-200 hover:bg-gray-300 p-1 rounded flex items-center justify-center" onClick={() => moveViewport(0, 1)}><IconChevronDown size={16} /></button>
            <div></div>
          </div>
          <div className="mt-1 text-xs text-center">
            Viewing: ({viewportPosition[0]},{viewportPosition[1]})
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-10 gap-px border-2 border-gray-400 p-1 bg-gray-200 overflow-visible">
        {visibleGrid().map((row, relY) =>
          row.map((tile, relX) => {
            const absoluteX = viewportPosition[0] + relX;
            const absoluteY = viewportPosition[1] + relY;

            let highlightClass = '';
            if (selectedUnit && selectedUnit.position[0] === absoluteX && selectedUnit.position[1] === absoluteY) {
              highlightClass = 'ring-4 ring-yellow-400 z-10';
            } else if (isInMovementRange(absoluteX, absoluteY)) {
              highlightClass = 'ring-4 ring-blue-300 ring-opacity-80 z-10';
            } else if (isInAttackRange(absoluteX, absoluteY)) {
              highlightClass = 'ring-4 ring-red-500 ring-opacity-80 z-10';
            }

            const tileUnit = tile.unit;
            const onCooldown = tileUnit ? isUnitOnCooldown(tileUnit.id) : false;
            const cooldownSecs = tileUnit ? getCooldownRemaining(tileUnit.id) : 0;

            return (
              <div
                key={`${absoluteX}-${absoluteY}`}
                className={`
                  w-10 h-10 relative
                  ${getTerrainColor(tile.terrain.type)}
                  ${highlightClass}
                  cursor-pointer
                  ${!actionMenu ? 'transition-all duration-200 hover:brightness-110' : ''}
                `}
                onClick={() => handleTileClick(absoluteX, absoluteY)}
              >
                {isInMovementRange(absoluteX, absoluteY) && (
                  <div className="absolute inset-0 bg-blue-400 bg-opacity-30 z-0"></div>
                )}

                {isInAttackRange(absoluteX, absoluteY) && (
                  <div className="absolute inset-0 bg-red-400 bg-opacity-30 z-0"></div>
                )}

                {tileUnit && (
                  <div
                    className={`
                      absolute inset-0 flex items-center justify-center
                      ${getUnitColor(tileUnit.player)}
                      rounded-full m-1 z-20
                      ${onCooldown ? 'opacity-40' : ''}
                      ${selectedUnit && selectedUnit.id === tileUnit.id ? 'ring-2 ring-yellow-300' : ''}
                    `}
                  >
                    {getUnitIcon(tileUnit.type)}
                    <div className="absolute bottom-0 right-0 text-xs bg-black bg-opacity-50 text-white px-1 rounded">
                      {tileUnit.health}
                    </div>
                    {/* Cooldown timer overlay */}
                    {onCooldown && (
                      <div className="absolute top-0 left-0 right-0 bg-orange-500 bg-opacity-80 text-white text-center text-xs font-bold rounded-t-full flex items-center justify-center gap-px">
                        <IconClock size={10} />{cooldownSecs}
                      </div>
                    )}
                  </div>
                )}

                {tile.terrain.isCity && (
                  <div className={`absolute inset-0 border-4 ${getCityOwnerColor(tile.terrain as City)}`}>
                    {/* Factory icon on owned empty cities */}
                    {!tileUnit && (tile.terrain as City).owner === 'Red' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <IconBuildingFactory size={28} className="text-red-600 opacity-70" />
                      </div>
                    )}
                    {!tileUnit && (tile.terrain as City).owner === 'Blue' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <IconBuildingFactory size={28} className="text-blue-600 opacity-70" />
                      </div>
                    )}
                    {(tile.terrain as City).captureProgress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${Math.min(100, ((tile.terrain as City).captureProgress / 20) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Factory dropdown anchored to tile */}
                {factoryMenu && factoryMenu.x === absoluteX && factoryMenu.y === absoluteY && (
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 z-50 ${relY >= viewSize / 2 ? 'bottom-full pb-1' : 'top-full pt-1'}`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="bg-white rounded shadow-lg border border-gray-300 p-2 w-48 space-y-1">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <IconBuildingFactory size={12} /> Factory — Buy Unit
                      </p>
                      {(['Infantry', 'Tank', 'Artillery'] as UnitType[]).map(unitType => (
                        <button
                          key={unitType}
                          className="w-full bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 flex items-center justify-between"
                          onClick={() => handleBuyUnit(unitType)}
                          disabled={resources.Red < UNIT_COSTS[unitType] || actionPoints.Red <= 0}
                        >
                          <span className="flex items-center gap-1">{getUnitIcon(unitType)} {unitType}</span>
                          <span>${UNIT_COSTS[unitType]}</span>
                        </button>
                      ))}
                      <p className="text-xs text-gray-500 text-center">Funds: ${resources.Red}</p>
                      <button
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs font-semibold"
                        onClick={() => setFactoryMenu(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action dropdown anchored to tile */}
                {actionMenu && actionMenu.x === absoluteX && actionMenu.y === absoluteY && (
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 z-50 ${relY >= viewSize / 2 ? 'bottom-full pb-1' : 'top-full pt-1'}`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="bg-white rounded shadow-lg border border-gray-300 p-2 w-44 space-y-1">
                      {/* Capture option */}
                      {actionMenu.canCapture && (
                        <>
                          <p className="text-xs text-gray-600 whitespace-nowrap">
                            Capture: {(grid[actionMenu.y]?.[actionMenu.x]?.terrain as City)?.captureProgress ?? 0}/20 (+{Math.floor(actionMenu.unit.health / 10)})
                          </p>
                          <button
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs font-semibold disabled:opacity-50"
                            onClick={handleCapture}
                            disabled={actionPoints.Red <= 0}
                          >
                            Capture {actionMenu.justMoved ? '' : '(1 AP)'}
                          </button>
                        </>
                      )}
                      {/* Attack options */}
                      {actionMenu.enemies.map((enemy) => (
                        <button
                          key={enemy.unit.id}
                          className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 flex items-center justify-between"
                          onClick={() => handleAttackFromMenu(enemy.x, enemy.y)}
                          disabled={actionPoints.Red <= 0 && !actionMenu.justMoved}
                        >
                          <span>Attack {enemy.unit.type}</span>
                          <span className="text-red-200">{enemy.unit.health}hp</span>
                        </button>
                      ))}
                      {/* Wait / Cancel */}
                      <button
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs font-semibold"
                        onClick={handleWait}
                      >
                        {actionMenu.justMoved ? 'Wait' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="absolute top-0 left-0 text-xs text-gray-700 opacity-50">
                  {absoluteX},{absoluteY}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Capture Menu - inline dropdown anchored to the tile */}

      {/* How to Play */}
      <div className="mt-2 bg-white p-2 rounded shadow w-full max-w-md">
        <div className="flex justify-between">
          <div>
            <h3 className="font-semibold text-sm">How to Play:</h3>
            <ul className="list-disc pl-4 text-xs">
              <li>Click a Red unit to select it</li>
              <li>Move (<span className="text-blue-500 font-semibold">blue</span>) or attack (<span className="text-red-500 font-semibold">red</span>) — each costs 1 AP</li>
              <li>After acting, units go on <span className="text-orange-500 font-semibold">60s cooldown</span></li>
              <li>AP regenerates: +1 every 60 seconds (max 10)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Unit Types:</h3>
            <div className="text-xs space-y-0.5">
              <p className="flex items-center gap-1"><IconSword size={12} /> Infantry - Basic unit</p>
              <p className="flex items-center gap-1"><IconShield size={12} /> Tank - Strong attack</p>
              <p className="flex items-center gap-1"><IconTarget size={12} /> Artillery - Long range</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
