import { useState, useEffect } from 'react';

// Define types
type UnitType = 'Infantry' | 'Tank' | 'Artillery' | 'APC';
type TerrainType = 'Plain' | 'Mountain' | 'Forest' | 'City' | 'Road';
type Player = 'Red' | 'Blue';

interface City extends Terrain {
  owner: Player | null;
  captureProgress: number;
}

interface Unit {
  id: string;
  type: UnitType;
  health: number;
  attack: number;
  defense: number;
  moveRange: number;
  attackRange: number;
  position: [number, number];
  hasMoved: boolean;
  hasAttacked: boolean;
  player: Player;
}

interface Terrain {
  type: TerrainType;
  defenseBonus: number;
  movementCost: number;
  isCity?: boolean; // Flag to identify cities
}

interface Tile {
  position: [number, number];
  terrain: Terrain;
  unit: Unit | null;
}

// Game constants
const GRID_SIZE = 20; // Expanded to 20x20
const UNIT_TYPES: Record<UnitType, Omit<Unit, 'id' | 'position' | 'hasMoved' | 'hasAttacked' | 'player'>> = {
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
  APC: {
    type: 'APC',
    health: 100,
    attack: 0,
    defense: 15,
    moveRange: 6,
    attackRange: 0,
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
    isCity: true 
  },
  Road: { type: 'Road', defenseBonus: 0, movementCost: 0.5 },
};

// Helper functions
const generateId = () => Math.random().toString(36).substring(2, 9);

const createUnit = (type: UnitType, position: [number, number], player: Player): Unit => ({
  id: generateId(),
  position,
  hasMoved: false,
  hasAttacked: false,
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

  // Add some mountains (scaled up for 20x20)
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.Mountain;
  }

  // Add some forests (scaled up for 20x20)
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.Forest;
  }

  // Add some cities (scaled up for 20x20)
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.City;
  }

  // Add multiple roads
  for (let i = 0; i < 3; i++) {
    const startX = Math.floor(Math.random() * GRID_SIZE);
    let x = startX;
    for (let y = 0; y < GRID_SIZE; y++) {
      grid[y][x].terrain = TERRAIN_TYPES.Road;
      // Make the road go left or right sometimes
      if (Math.random() > 0.7 && x > 0 && x < GRID_SIZE - 1) {
        x += Math.random() > 0.5 ? 1 : -1;
      }
    }
  }

  // Add horizontal roads too
  for (let i = 0; i < 3; i++) {
    const startY = Math.floor(Math.random() * GRID_SIZE);
    let y = startY;
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[y][x].terrain = TERRAIN_TYPES.Road;
      // Make the road go up or down sometimes
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

const isInRange = (unitPosition: [number, number], targetPosition: [number, number], range: number): boolean => {
  const [ux, uy] = unitPosition;
  const [tx, ty] = targetPosition;
  const distance = Math.abs(ux - tx) + Math.abs(uy - ty);
  return distance <= range;
};

const Game = () => {
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player>('Red');
  const [movementRange, setMovementRange] = useState<[number, number][]>([]);
  const [attackRange, setAttackRange] = useState<[number, number][]>([]);
  const [gameStatus, setGameStatus] = useState<string>('Select a unit to move');
  const [viewportPosition, setViewportPosition] = useState<[number, number]>([0, 0]); // Track viewport position for large grid
  const [viewSize, setViewSize] = useState<number>(10); // Number of tiles visible at once
  const [resources, setResources] = useState<Record<Player, number>>({
    Red: 1000,
    Blue: 1000,
  });

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const initialGrid = generateInitialGrid();
    
    // Add initial units with more separation for a 20x20 grid
    
    // Red player's units - top left corner
    initialGrid[1][2].unit = createUnit('Infantry', [2, 1], 'Red');
    initialGrid[2][1].unit = createUnit('Tank', [1, 2], 'Red');
    initialGrid[3][2].unit = createUnit('Artillery', [2, 3], 'Red');
    initialGrid[1][4].unit = createUnit('Infantry', [4, 1], 'Red');
    initialGrid[2][5].unit = createUnit('APC', [5, 2], 'Red');
    
    // Blue player's units - bottom right corner
    initialGrid[GRID_SIZE - 2][GRID_SIZE - 3].unit = createUnit('Infantry', [GRID_SIZE - 3, GRID_SIZE - 2], 'Blue');
    initialGrid[GRID_SIZE - 3][GRID_SIZE - 2].unit = createUnit('Tank', [GRID_SIZE - 2, GRID_SIZE - 3], 'Blue');
    initialGrid[GRID_SIZE - 4][GRID_SIZE - 3].unit = createUnit('Artillery', [GRID_SIZE - 3, GRID_SIZE - 4], 'Blue');
    initialGrid[GRID_SIZE - 2][GRID_SIZE - 5].unit = createUnit('Infantry', [GRID_SIZE - 5, GRID_SIZE - 2], 'Blue');
    initialGrid[GRID_SIZE - 3][GRID_SIZE - 6].unit = createUnit('APC', [GRID_SIZE - 6, GRID_SIZE - 3], 'Blue');
    
    setGrid(initialGrid);
  };

  // Initialize cities with ownership
  const initializeGrid = () => {
    const initialGrid = generateInitialGrid();
    
    // Process each tile to add city ownership
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (initialGrid[y][x].terrain.type === 'City') {
          initialGrid[y][x].terrain = {
            ...initialGrid[y][x].terrain,
            owner: null,
            captureProgress: 0
          } as City;
        }
      }
    }
    
    // Assign initial cities to players - first city on either end of map
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
    
    return initialGrid;
  };

  // Handle capturing cities
  const captureCity = (unit: Unit, x: number, y: number) => {
    const tile = grid[y][x];
    if (!tile.terrain.isCity) return false;
    
    const city = tile.terrain as City;
    
    // Reset capture progress if city belongs to enemy
    if (city.owner && city.owner !== unit.player) {
      city.captureProgress = 0;
    }
    
    // Increase capture progress (Infantry captures in 2 turns)
    const captureAmount = unit.type === 'Infantry' ? 50 : 0; // Only infantry can capture
    
    if (captureAmount > 0) {
      city.captureProgress += captureAmount;
      
      // If city is fully captured
      if (city.captureProgress >= 100) {
        city.owner = unit.player;
        city.captureProgress = 0;
        setGameStatus(`${unit.player} captured a city!`);
      } else {
        setGameStatus(`Capturing: ${city.captureProgress}%`);
      }
      
      // Update grid with modified city
      const updatedGrid = [...grid];
      updatedGrid[y][x].terrain = city;
      
      // Mark unit as having "attacked" (used its action)
      const updatedUnit = { ...unit, hasAttacked: true };
      updatedGrid[y][x].unit = updatedUnit;

      setGrid(updatedGrid);
      setSelectedUnit(updatedUnit);
      return true;
    }
    
    return false;
  };

  const calculateMovementRange = (unit: Unit): [number, number][] => {
    const [x, y] = unit.position;
    const range = unit.moveRange;
    const validMoves: [number, number][] = [];
    
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        
        // Skip if out of bounds
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        
        // Skip if the tile already has a unit
        if (grid[ny][nx].unit !== null) continue;
        
        // Calculate Manhattan distance
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= range) {
          validMoves.push([nx, ny]);
        }
      }
    }
    
    return validMoves;
  };

  const calculateAttackRange = (unit: Unit): [number, number][] => {
    const [x, y] = unit.position;
    const range = unit.attackRange;
    const validAttacks: [number, number][] = [];
    
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        
        // Skip if out of bounds
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        
        // Skip if the tile has no unit or is our own unit
        if (grid[ny][nx].unit === null || grid[ny][nx].unit?.player === unit.player) continue;
        
        // Calculate Manhattan distance
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= range) {
          validAttacks.push([nx, ny]);
        }
      }
    }
    
    return validAttacks;
  };

  const handleUnitSelect = (x: number, y: number) => {
    const unit = grid[y][x].unit;
    
    if (!unit) {
      setSelectedUnit(null);
      setMovementRange([]);
      setAttackRange([]);
      return;
    }
    
    if (unit.player !== currentPlayer) {
      setGameStatus(`It's ${currentPlayer}'s turn`);
      return;
    }
    
    if (unit.hasMoved && unit.hasAttacked) {
      setGameStatus('This unit has already moved and attacked this turn');
      return;
    }
    
    setSelectedUnit(unit);
    
    // Center viewport on selected unit
    centerViewportOn(x, y);
    
    if (!unit.hasMoved) {
      const moveRange = calculateMovementRange(unit);
      setMovementRange(moveRange);
      setGameStatus('Select a tile to move to');
    } else if (!unit.hasAttacked && unit.attackRange > 0) {
      const attackRange = calculateAttackRange(unit);
      setAttackRange(attackRange);
      setGameStatus('Select an enemy unit to attack');
    }
  };

  const handleTileClick = (x: number, y: number) => {
    // Handle city capture attempt (when unit is on a capturable tile)
    if (selectedUnit && 
        !selectedUnit.hasAttacked && 
        selectedUnit.position[0] === x && 
        selectedUnit.position[1] === y &&
        grid[y][x].terrain.isCity) {
      const city = grid[y][x].terrain as City;
      
      // City is either neutral or belongs to the enemy
      if (!city.owner || city.owner !== selectedUnit.player) {
        if (captureCity(selectedUnit, x, y)) {
          return; // Capture action was performed, exit the function
        }
      }
    }

    if (!selectedUnit) {
      if (grid[y][x].unit && grid[y][x].unit.player === currentPlayer) {
        handleUnitSelect(x, y);
      }
      return;
    }
    
    // Movement logic
    if (!selectedUnit.hasMoved && movementRange.some(([mx, my]) => mx === x && my === y)) {
      moveUnit(selectedUnit, x, y);
      return;
    }
    
    // Attack logic
    if (!selectedUnit.hasAttacked && attackRange.some(([ax, ay]) => ax === x && ay === y)) {
      attackUnit(selectedUnit, x, y);
      return;
    }
    
    // If we clicked on another unit of ours, select it instead
    if (grid[y][x].unit && grid[y][x].unit.player === currentPlayer) {
      handleUnitSelect(x, y);
      return;
    }
    
    // Clear selection if clicking elsewhere
    setSelectedUnit(null);
    setMovementRange([]);
    setAttackRange([]);
  };

  const moveUnit = (unit: Unit, x: number, y: number) => {
    const updatedGrid = [...grid];
    
    // If unit was on a city that was being captured, reset progress if we move away
    const [oldX, oldY] = unit.position;
    updatedGrid[oldY][oldX].unit = null;

    const oldTile = grid[oldY][oldX];
    if (oldTile.terrain.isCity) {
      const city = oldTile.terrain as City;
      if (city.owner !== unit.player && city.captureProgress > 0) {
        city.captureProgress = 0;
        updatedGrid[oldY][oldX].terrain = city;
      }
    }
   
    // Update unit position
    const updatedUnit = { ...unit, position: [x, y] as [number, number], hasMoved: true };
    
    // Place unit at new position
    updatedGrid[y][x].unit = updatedUnit;
    
    setGrid(updatedGrid);
    setSelectedUnit(updatedUnit);
    setMovementRange([]);
    
    // Center viewport on the new position
    centerViewportOn(x, y);
    
    // Check if the unit can attack after moving
    if (updatedUnit.attackRange > 0) {
      const newAttackRange = calculateAttackRange(updatedUnit);
      setAttackRange(newAttackRange);
      if (newAttackRange.length > 0) {
        setGameStatus('Select an enemy unit to attack');
      } else {
        setGameStatus('No enemies in range to attack');
        setSelectedUnit(null);
      }
    } else {
      setSelectedUnit(null);
      setGameStatus('Select another unit');
    }
  };

  const attackUnit = (attacker: Unit, x: number, y: number) => {
    const updatedGrid = [...grid];
    const defender = grid[y][x].unit!;
    const terrain = grid[y][x].terrain;
    
    // Calculate damage
    const damage = calculateDamage(attacker, defender, terrain);
    
    // Apply damage to defender
    const updatedDefender = { ...defender, health: defender.health - damage };
    
    // Update attacker to mark it as having attacked
    const updatedAttacker = { ...attacker, hasAttacked: true };
    const [attackerX, attackerY] = attacker.position;
    
    updatedGrid[attackerY][attackerX].unit = updatedAttacker;
    
    // If defender is destroyed, remove it
    if (updatedDefender.health <= 0) {
      updatedGrid[y][x].unit = null;
      setGameStatus(`${defender.type} destroyed!`);
    } else {
      updatedGrid[y][x].unit = updatedDefender;
      setGameStatus(`${defender.type} took ${damage} damage!`);
    }
    
    setGrid(updatedGrid);
    setSelectedUnit(null);
    setAttackRange([]);
    
    // Check if the game is over
    const unitsLeft = {
      Red: 0,
      Blue: 0
    };
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const unit = updatedGrid[y][x].unit;
        if (unit) {
          unitsLeft[unit.player]++;
        }
      }
    }
    
    if (unitsLeft.Red === 0) {
      setGameStatus('Blue wins!');
      return;
    }
    
    if (unitsLeft.Blue === 0) {
      setGameStatus('Red wins!');
      return;
    }
  };

  const endTurn = () => {
    // Reset all units' move and attack status for next player
    const updatedGrid = grid.map(row => row.map(tile => {
      if (tile.unit && tile.unit.player === currentPlayer) {
        return {
          ...tile,
          unit: {
            ...tile.unit,
            hasMoved: false,
            hasAttacked: false
          }
        };
      }
      return tile;
    }));
    
    setGrid(updatedGrid);
    // Before changing the current player, collect resources from owned cities
    const nextPlayer = currentPlayer === 'Red' ? 'Blue' : 'Red';
    let cityIncome = 0;
    
    // Count cities owned by the next player
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const terrain = grid[y][x].terrain;
        if (terrain.isCity && (terrain as City).owner === nextPlayer) {
          cityIncome += 100; // Each city provides 100 funds per turn
        }
      }
    }
    
    // Update resources for the next player
    if (cityIncome > 0) {
      setResources(prev => ({
        ...prev,
        [nextPlayer]: prev[nextPlayer] + cityIncome
      }));
      setGameStatus(`${nextPlayer} received ${cityIncome} funds from cities`);
    }
    setCurrentPlayer(nextPlayer);
    setSelectedUnit(null);
    setMovementRange([]);
    setAttackRange([]);
    setGameStatus(`${nextPlayer}'s turn`);
    
    // Find a unit of the next player to center the viewport on
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (updatedGrid[y][x].unit && updatedGrid[y][x].unit.player === nextPlayer) {
          centerViewportOn(x, y);
          return;
        }
      }
    }
  };

  // Render the city ownership on the game board
  const getCityOwnerColor = (city: City): string => {
    if (!city.owner) return 'border-gray-600'; // Neutral
    return city.owner === 'Red' ? 'border-red-600' : 'border-blue-600';
  };

  const isInMovementRange = (x: number, y: number): boolean => {
    return movementRange.some(([mx, my]) => mx === x && my === y);
  };

  const isInAttackRange = (x: number, y: number): boolean => {
    return attackRange.some(([ax, ay]) => ax === x && ay === y);
  };
  
  const moveViewport = (dx: number, dy: number) => {
    const [x, y] = viewportPosition;
    const newX = Math.max(0, Math.min(GRID_SIZE - viewSize, x + dx));
    const newY = Math.max(0, Math.min(GRID_SIZE - viewSize, y + dy));
    setViewportPosition([newX, newY]);
  };
  
  const centerViewportOn = (x: number, y: number) => {
    const halfViewSize = Math.floor(viewSize / 2);
    const newX = Math.max(0, Math.min(GRID_SIZE - viewSize, x - halfViewSize));
    const newY = Math.max(0, Math.min(GRID_SIZE - viewSize, y - halfViewSize));
    setViewportPosition([newX, newY]);
  };
  
  // Get the visible portion of the grid
  const visibleGrid = () => {
    const [viewX, viewY] = viewportPosition;
    const viewGrid: Tile[][] = [];
    
    for (let y = viewY; y < Math.min(GRID_SIZE, viewY + viewSize); y++) {
      const row: Tile[] = [];
      for (let x = viewX; x < Math.min(GRID_SIZE, viewX + viewSize); x++) {
        if (grid[y] && grid[y][x]) {
          row.push(grid[y][x]);
        }
      }
      viewGrid.push(row);
    }
    
    return viewGrid;
  };

  // Find all units of the current player
  const findCurrentPlayerUnits = (): [number, number][] => {
    const units: [number, number][] = [];
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (grid[y] && grid[y][x] && grid[y][x].unit && grid[y][x].unit.player === currentPlayer) {
          units.push([x, y]);
        }
      }
    }
    
    return units;
  };
  
  const cycleToNextUnit = () => {
    const units = findCurrentPlayerUnits();
    if (units.length === 0) return;
    
    // Find the next unit after the selected one
    let nextUnitIndex = 0;
    if (selectedUnit) {
      const [selectedX, selectedY] = selectedUnit.position;
      const currentIndex = units.findIndex(([x, y]) => x === selectedX && y === selectedY);
      if (currentIndex !== -1) {
        nextUnitIndex = (currentIndex + 1) % units.length;
      }
    }
    
    const [x, y] = units[nextUnitIndex];
    handleUnitSelect(x, y);
  };

  return (
    <div className="flex flex-col items-center p-2 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-2">Battle for Fun</h1>
      
      <div className="flex flex-wrap gap-2 mb-2 justify-center">
        <div className="bg-white p-2 rounded shadow">
          <h2 className="text-lg font-semibold">Turn: <span className={currentPlayer === 'Red' ? 'text-red-600' : 'text-blue-600'}>{currentPlayer}</span></h2>
          <p className="text-sm">{gameStatus}</p>
          <div className="flex gap-4 mb-2">
            <p className="text-red-600 font-bold">Red: ${resources.Red}</p>
            <p className="text-blue-600 font-bold">Blue: ${resources.Blue}</p>
          </div>
          <div className="flex gap-2 mt-2">
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
              onClick={endTurn}
            >
              End Turn
            </button>
            <button 
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
              onClick={cycleToNextUnit}
            >
              Next Unit
            </button>
          </div>
        </div>
        
        <div className="bg-white p-2 rounded shadow">
          <h3 className="text-sm font-semibold mb-1">Navigation:</h3>
          <div className="grid grid-cols-3 gap-1">
            <div></div>
            <button 
              className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
              onClick={() => moveViewport(0, -1)}
            >
              ↑
            </button>
            <div></div>
            <button 
              className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
              onClick={() => moveViewport(-1, 0)}
            >
              ←
            </button>
            <button 
              className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
              onClick={() => {
                const units = findCurrentPlayerUnits();
                if (units.length > 0) {
                  const [x, y] = units[0];
                  centerViewportOn(x, y);
                }
              }}
            >
              ⌂
            </button>
            <button 
              className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
              onClick={() => moveViewport(1, 0)}
            >
              →
            </button>
            <div></div>
            <button 
              className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
              onClick={() => moveViewport(0, 1)}
            >
              ↓
            </button>
            <div></div>
          </div>
          <div className="mt-1 text-xs text-center">
            Viewing: ({viewportPosition[0]},{viewportPosition[1]})
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-10 gap-px border-2 border-gray-400 p-1 bg-gray-200">
        {visibleGrid().map((row, relY) => (
          row.map((tile, relX) => {
            const absoluteX = viewportPosition[0] + relX;
            const absoluteY = viewportPosition[1] + relY;
            
            // Determine tile highlighting
            let highlightClass = '';
            
            // Selected unit highlight
            if (selectedUnit && selectedUnit.position[0] === absoluteX && selectedUnit.position[1] === absoluteY) {
              highlightClass = 'ring-4 ring-yellow-400 z-10';
            }
            // Movement range highlight
            else if (isInMovementRange(absoluteX, absoluteY)) {
              highlightClass = 'ring-4 ring-blue-300 ring-opacity-80 z-10';
            }
            // Attack range highlight
            else if (isInAttackRange(absoluteX, absoluteY)) {
              highlightClass = 'ring-4 ring-red-500 ring-opacity-80 z-10';
            }
            
            return (
              <div 
                key={`${absoluteX}-${absoluteY}`}
                className={`
                  w-10 h-10 relative 
                  ${getTerrainColor(tile.terrain.type)}
                  ${highlightClass}
                  cursor-pointer
                  transition-all duration-200
                  hover:brightness-110
                `}
                onClick={() => handleTileClick(absoluteX, absoluteY)}
              >
                {/* Movement overlay */}
                {isInMovementRange(absoluteX, absoluteY) && (
                  <div className="absolute inset-0 bg-blue-400 bg-opacity-30 z-0"></div>
                )}
                
                {/* Attack overlay */}
                {isInAttackRange(absoluteX, absoluteY) && (
                  <div className="absolute inset-0 bg-red-400 bg-opacity-30 z-0"></div>
                )}
                
                {/* Unit */}
                {tile.unit && (
                  <div 
                    className={`
                      absolute inset-0 flex items-center justify-center
                      ${getUnitColor(tile.unit.player)}
                      rounded-full m-1 z-20
                      ${tile.unit.hasMoved || tile.unit.hasAttacked ? 'opacity-50' : ''}
                      ${selectedUnit && selectedUnit.id === tile.unit.id ? 'ring-2 ring-yellow-300' : ''}
                    `}
                  >
                    <div className="text-xs font-bold text-white">
                      {tile.unit.type.charAt(0)}
                    </div>
                    <div className="absolute bottom-0 right-0 text-xs bg-black bg-opacity-50 text-white px-1 rounded">
                      {tile.unit.health}
                    </div>
                  </div>
                )}

                {tile.terrain.isCity && (
                  <div 
                    className={`absolute inset-0 border-4 ${getCityOwnerColor(tile.terrain as City)}`}
                  >
                    {(tile.terrain as City).captureProgress > 0 && (
                      <div 
                        className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600"
                      >
                        <div 
                          className="h-full bg-yellow-500" 
                          style={{ width: `${(tile.terrain as City).captureProgress}%` }} 
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {/* Coordinates display */}
                <div className="absolute top-0 left-0 text-xs text-gray-700 opacity-50">
                  {absoluteX},{absoluteY}
                </div>
              </div>
            );
          })
        ))}
      </div>
      
      <div className="mt-2 bg-white p-2 rounded shadow w-full max-w-md">
        <div className="flex justify-between">
          <div>
            <h3 className="font-semibold text-sm">How to Play:</h3>
            <ul className="list-disc pl-4 text-xs">
              <li>Click on a unit to select it</li>
              <li>Click on a <span className="text-blue-500 font-semibold">blue highlighted</span> tile to move</li>
              <li>Click on a <span className="text-red-500 font-semibold">red highlighted</span> enemy to attack</li>
              <li>Use arrow buttons to navigate the map</li>
              <li>Use "Next Unit" to cycle through your units</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-sm">Unit Types:</h3>
            <div className="text-xs">
              <p><strong>I</strong>: Infantry - Basic unit</p>
              <p><strong>T</strong>: Tank - Strong attack</p>
              <p><strong>A</strong>: Artillery - Long range</p>
              <p><strong>P</strong>: APC - Fast movement</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;