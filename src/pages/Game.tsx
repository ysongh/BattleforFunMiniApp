import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import type { UnitType, Player, City, Unit, Tile } from '../types/game';
import { computeAIAction } from '../lib/ai';
import { calculateDamage, countPlayerUnits } from '../lib/combat';
import { GRID_SIZE, COOLDOWN_DURATION, AP_REGEN_INTERVAL, AI_ACTION_INTERVAL, MAX_AP, UNIT_COSTS } from '../lib/constants';
import { generateInitialGrid, calculateMovementRange as calcMovementRange, calculateAttackRange as calcAttackRange, findEnemiesInRange as findEnemies } from '../lib/grid';
import { createUnit } from '../lib/units';
import GameBoard3D from '../components/GameBoard3D';
import { playAttack, playCounterAttack, playImpact, playDestroyed, playSelect, playMove, playCaptured, playVictory, playDefeat } from '../lib/sounds';
import {
  IconSword,
  IconShield,
  IconTarget,
  IconPlayerTrackNext,
  IconRobot,
  IconBolt,
  IconBuildingFactory,
} from '@tabler/icons-react';

// UI helper (returns JSX, so stays in component file)
const getUnitIcon = (type: UnitType) => {
  switch (type) {
    case 'Infantry': return <IconSword size={16} stroke={2.5} color="white" />;
    case 'Tank': return <IconShield size={16} stroke={2.5} color="white" />;
    case 'Artillery': return <IconTarget size={16} stroke={2.5} color="white" />;
  }
};


const Game = () => {
  const location = useLocation();
  const lobbyState = location.state as { isAIEnabled?: boolean; aiDifficulty?: 'easy' | 'medium' | 'hard' } | null;

  const [grid, setGrid] = useState<Tile[][]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [movementRange, setMovementRange] = useState<[number, number][]>([]);
  const [attackRange, setAttackRange] = useState<[number, number][]>([]);
  const [gameStatus, setGameStatus] = useState<string>('Select a unit to act');
  const [resources, setResources] = useState<Record<Player, number>>({ Red: 1000, Blue: 1000 });

  // AP & Cooldown state
  const [actionPoints, setActionPoints] = useState<Record<Player, number>>({ Red: 5, Blue: 5 });
  const [unitCooldowns, setUnitCooldowns] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [attackEvent, setAttackEvent] = useState<{ attackerPos: [number, number]; defenderPos: [number, number]; timestamp: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Action menu state: shown after moving near enemies or onto a capturable city
  const [actionMenu, setActionMenu] = useState<{
    unit: Unit; x: number; y: number; justMoved: boolean;
    canCapture: boolean;
    enemies: { unit: Unit; x: number; y: number }[];
  } | null>(null);

  // Factory menu state: shown when clicking an owned city with no unit
  const [factoryMenu, setFactoryMenu] = useState<{ x: number; y: number } | null>(null);

  // Screen position of the last tile click, used to position popup menus
  const [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number; openAbove: boolean } | null>(null);

  const computeMenuAnchor = (screenX: number, screenY: number) => {
    const openAbove = window.innerHeight - screenY < 220;
    setMenuAnchor({ left: screenX, top: screenY, openAbove });
  };

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

    const action = computeAIAction({
      grid: gridRef.current,
      actionPoints: apRef.current.Blue,
      cooldowns: cooldownsRef.current,
      difficulty: aiDifficultyRef.current,
    });

    if (!action) return;

    setGrid(action.newGrid);
    setActionPoints(prev => ({ ...prev, Blue: prev.Blue - 1 }));
    setUnitCooldowns(prev => ({ ...prev, [action.unit.id]: Date.now() + COOLDOWN_DURATION }));

    if (action.type === 'attack') {
      setGameStatus(`AI ${action.unit.type} attacked!`);
      playAttack(isMuted);
      setAttackEvent({ attackerPos: action.unit.position, defenderPos: [action.targetX, action.targetY], timestamp: performance.now() });
      setTimeout(() => setAttackEvent(null), 800);
      const defenderAfter = action.newGrid[action.targetY][action.targetX].unit;
      if (!defenderAfter) setTimeout(() => playDestroyed(isMuted), 450);
      else setTimeout(() => playImpact(isMuted), 450);
      // Check win
      if (countPlayerUnits(action.newGrid, 'Red') === 0) {
        setGameStatus('Blue wins!');
        gameOverRef.current = true;
      }
    } else {
      setGameStatus(`AI ${action.unit.type} moved`);
    }
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
    playSelect(isMuted);
    centerViewportOn(x, y);

    // Check for nearby actions: capture or attack
    const tile = grid[y][x];
    const canCapture = unit.type === 'Infantry' && !!tile.terrain.isCity &&
      (!((tile.terrain as City).owner) || (tile.terrain as City).owner !== unit.player);
    const nearbyEnemies = findEnemies(unit, x, y, grid);

    if (canCapture || nearbyEnemies.length > 0) {
      setActionMenu({ unit, x, y, justMoved: false, canCapture, enemies: nearbyEnemies });
      setGameStatus(canCapture ? 'Capture, attack, or continue?' : 'Attack or continue?');
      return;
    }

    const moveRange = calcMovementRange(unit, grid);
    setMovementRange(moveRange);

    const atkRange = calcAttackRange(unit, grid);
    setAttackRange(atkRange);

    if (moveRange.length > 0 || atkRange.length > 0) {
      setGameStatus('Move or attack (each costs 1 AP)');
    } else {
      setGameStatus('No valid moves or attacks');
    }
  };

  const handleTileClick = (x: number, y: number, screenX = window.innerWidth / 2, screenY = window.innerHeight / 2) => {
    computeMenuAnchor(screenX, screenY);
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

    playMove(isMuted);
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
      setResources(prev => ({ ...prev, [unit.player]: prev[unit.player] + 1000 }));
      playCaptured(isMuted);
      setGameStatus(`${unit.player} captured a city! +$1000`);
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
      const moveRange = calcMovementRange(unit, grid);
      const atkRange = calcAttackRange(unit, grid);
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

    playAttack(isMuted);
    if (updatedDefender.health <= 0) {
      updatedGrid[enemyY][enemyX].unit = null;
      setTimeout(() => playDestroyed(isMuted), 450);
      setGameStatus(`${defender.type} destroyed!`);
    } else {
      updatedGrid[enemyY][enemyX].unit = updatedDefender;
      setTimeout(() => playImpact(isMuted), 450);

      // Counter-attack: close-range enemy strikes back based on its remaining health
      const [ax, ay] = unit.position;
      const distance = Math.abs(enemyX - ax) + Math.abs(enemyY - ay);
      if (updatedDefender.attackRange === 1 && distance <= 1) {
        const attackerTerrain = updatedGrid[ay][ax].terrain;
        const counterDamage = calculateDamage(updatedDefender, unit, attackerTerrain);
        const updatedAttacker = { ...unit, health: unit.health - counterDamage };
        if (updatedAttacker.health <= 0) {
          updatedGrid[ay][ax].unit = null;
          setTimeout(() => { playCounterAttack(isMuted); setTimeout(() => playDestroyed(isMuted), 300); }, 600);
          setGameStatus(`${defender.type} took ${damage} dmg and counter-attacked, destroying ${unit.type}!`);
        } else {
          updatedGrid[ay][ax].unit = updatedAttacker;
          setTimeout(() => playCounterAttack(isMuted), 600);
          setGameStatus(`${defender.type} took ${damage} dmg and counter-attacked for ${counterDamage}!`);
        }
      } else {
        setGameStatus(`${defender.type} took ${damage} damage!`);
      }
    }

    setAttackEvent({ attackerPos: unit.position, defenderPos: [enemyX, enemyY], timestamp: performance.now() });
    setTimeout(() => setAttackEvent(null), 800);
    setGrid(updatedGrid);
    // Only deduct AP if the unit didn't already spend AP on moving
    if (!justMoved) {
      setActionPoints(prev => ({ ...prev, Red: prev.Red - 1 }));
    }
    setUnitCooldowns(prev => ({ ...prev, [unit.id]: Date.now() + COOLDOWN_DURATION }));
    setActionMenu(null);

    // Check win conditions
    if (countPlayerUnits(updatedGrid, 'Blue') === 0) {
      setGameStatus('Red wins!');
      gameOverRef.current = true;
      playVictory(isMuted);
    }
    if (countPlayerUnits(updatedGrid, 'Red') === 0) {
      setGameStatus('Blue wins!');
      gameOverRef.current = true;
      playDefeat(isMuted);
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

    playAttack(isMuted);
    if (updatedDefender.health <= 0) {
      updatedGrid[y][x].unit = null;
      setTimeout(() => playDestroyed(isMuted), 450);
      setGameStatus(`${defender.type} destroyed!`);
    } else {
      updatedGrid[y][x].unit = updatedDefender;
      setTimeout(() => playImpact(isMuted), 450);

      // Counter-attack: close-range enemy strikes back based on its remaining health
      const [ax, ay] = attacker.position;
      const distance = Math.abs(x - ax) + Math.abs(y - ay);
      if (updatedDefender.attackRange === 1 && distance <= 1) {
        const attackerTerrain = grid[ay][ax].terrain;
        const counterDamage = calculateDamage(updatedDefender, attacker, attackerTerrain);
        const updatedAttacker = { ...attacker, health: attacker.health - counterDamage };
        if (updatedAttacker.health <= 0) {
          updatedGrid[ay][ax].unit = null;
          setTimeout(() => { playCounterAttack(isMuted); setTimeout(() => playDestroyed(isMuted), 300); }, 600);
          setGameStatus(`${defender.type} took ${damage} dmg and counter-attacked, destroying ${attacker.type}!`);
        } else {
          updatedGrid[ay][ax].unit = updatedAttacker;
          setTimeout(() => playCounterAttack(isMuted), 600);
          setGameStatus(`${defender.type} took ${damage} dmg and counter-attacked for ${counterDamage}!`);
        }
      } else {
        setGameStatus(`${defender.type} took ${damage} damage!`);
      }
    }

    setAttackEvent({ attackerPos: attacker.position, defenderPos: [x, y], timestamp: performance.now() });
    setTimeout(() => setAttackEvent(null), 800);
    setGrid(updatedGrid);
    setActionPoints(prev => ({ ...prev, Red: prev.Red - 1 }));
    setUnitCooldowns(prev => ({ ...prev, [attacker.id]: Date.now() + COOLDOWN_DURATION }));
    setSelectedUnit(null);
    setMovementRange([]);
    setAttackRange([]);

    // Check win conditions
    if (countPlayerUnits(updatedGrid, 'Blue') === 0) {
      setGameStatus('Red wins!');
      gameOverRef.current = true;
      playVictory(isMuted);
    }
    if (countPlayerUnits(updatedGrid, 'Red') === 0) {
      setGameStatus('Blue wins!');
      gameOverRef.current = true;
      playDefeat(isMuted);
    }
  };

  // --- Viewport & navigation ---

  // centerViewportOn is a no-op in 3D mode (OrbitControls handles camera)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const centerViewportOn = (_x: number, _y: number) => { /* no-op: 3D camera managed by OrbitControls */ };

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
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold">Battle for Fun</h1>
        <button
          onClick={() => setIsMuted(m => !m)}
          className="text-lg px-2 py-0.5 rounded bg-white shadow hover:bg-gray-100 border"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

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

        {/* Camera hint */}
        <div className="bg-white p-2 rounded shadow text-xs text-gray-500 self-center">
          <p className="font-semibold text-gray-700 mb-0.5">Camera</p>
          <p>Drag — rotate</p>
          <p>Scroll — zoom</p>
          <p>Right-drag — pan</p>
        </div>
      </div>

      {/* 3D Board */}
      <div className="w-full max-w-3xl">
        <GameBoard3D
          grid={grid}
          selectedUnit={selectedUnit}
          movementRange={movementRange}
          attackRange={attackRange}
          unitCooldowns={unitCooldowns}
          now={now}
          onTileClick={handleTileClick}
          attackEvent={attackEvent}
        />
      </div>

      {/* Factory menu portal */}
      {factoryMenu && menuAnchor && createPortal(
        <div
          className="fixed z-[9999]"
          style={{
            left: menuAnchor.left,
            top: menuAnchor.top,
            transform: menuAnchor.openAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 8px)',
          }}
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
        </div>,
        document.body
      )}

      {/* Action menu portal */}
      {actionMenu && menuAnchor && createPortal(
        <div
          className="fixed z-[9999]"
          style={{
            left: menuAnchor.left,
            top: menuAnchor.top,
            transform: menuAnchor.openAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 8px)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded shadow-lg border border-gray-300 p-2 w-44 space-y-1">
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
            <button
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs font-semibold"
              onClick={handleWait}
            >
              {actionMenu.justMoved ? 'Wait' : 'Cancel'}
            </button>
          </div>
        </div>,
        document.body
      )}

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
