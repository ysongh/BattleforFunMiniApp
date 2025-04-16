import { useState, useEffect } from 'react';

// Define types
type UnitType = 'Infantry' | 'Tank' | 'Artillery' | 'APC';
type TerrainType = 'Plain' | 'Mountain' | 'Forest' | 'City' | 'Road';
type Player = 'Red' | 'Blue';

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
}

interface Tile {
  position: [number, number];
  terrain: Terrain;
  unit: Unit | null;
}

// Game constants
const GRID_SIZE = 10;
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
  City: { type: 'City', defenseBonus: 20, movementCost: 1 },
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

  // Add some mountains
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.Mountain;
  }

  // Add some forests
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.Forest;
  }

  // Add some cities
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    grid[y][x].terrain = TERRAIN_TYPES.City;
  }

  // Add a road
  const startX = Math.floor(Math.random() * GRID_SIZE);
  let x = startX;
  for (let y = 0; y < GRID_SIZE; y++) {
    grid[y][x].terrain = TERRAIN_TYPES.Road;
    // Make the road go left or right sometimes
    if (Math.random() > 0.7 && x > 0 && x < GRID_SIZE - 1) {
      x += Math.random() > 0.5 ? 1 : -1;
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

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const initialGrid = generateInitialGrid();
    
    // Add initial units
    // Red player's units
    initialGrid[0][1].unit = createUnit('Infantry', [1, 0], 'Red');
    initialGrid[1][0].unit = createUnit('Tank', [0, 1], 'Red');
    initialGrid[2][1].unit = createUnit('Artillery', [1, 2], 'Red');
    
    // Blue player's units
    initialGrid[GRID_SIZE - 1][GRID_SIZE - 2].unit = createUnit('Infantry', [GRID_SIZE - 2, GRID_SIZE - 1], 'Blue');
    initialGrid[GRID_SIZE - 2][GRID_SIZE - 1].unit = createUnit('Tank', [GRID_SIZE - 1, GRID_SIZE - 2], 'Blue');
    initialGrid[GRID_SIZE - 3][GRID_SIZE - 2].unit = createUnit('Artillery', [GRID_SIZE - 2, GRID_SIZE - 3], 'Blue');
    
    setGrid(initialGrid);
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
    
    // Remove unit from old position
    const [oldX, oldY] = unit.position;
    updatedGrid[oldY][oldX].unit = null;
    
    // Update unit position
    const updatedUnit = { ...unit, position: [x, y] as [number, number], hasMoved: true };
    
    // Place unit at new position
    updatedGrid[y][x].unit = updatedUnit;
    
    setGrid(updatedGrid);
    setSelectedUnit(updatedUnit);
    setMovementRange([]);
    
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
    setCurrentPlayer(currentPlayer === 'Red' ? 'Blue' : 'Red');
    setSelectedUnit(null);
    setMovementRange([]);
    setAttackRange([]);
    setGameStatus(`${currentPlayer === 'Red' ? 'Blue' : 'Red'}'s turn`);
  };

  const isInMovementRange = (x: number, y: number): boolean => {
    return movementRange.some(([mx, my]) => mx === x && my === y);
  };

  const isInAttackRange = (x: number, y: number): boolean => {
    return attackRange.some(([ax, ay]) => ax === x && ay === y);
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Battle for Fun</h1>
      
      <div className="mb-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Turn: {currentPlayer}</h2>
          <p className="mb-2">{gameStatus}</p>
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={endTurn}
          >
            End Turn
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-10 gap-1 border-2 border-gray-400 p-1 bg-gray-200">
        {grid.map((row, y) => (
          row.map((tile, x) => (
            <div 
              key={`${x}-${y}`}
              className={`
                w-12 h-12 relative
                ${getTerrainColor(tile.terrain.type)}
                ${isInMovementRange(x, y) ? 'ring-2 ring-white' : ''}
                ${isInAttackRange(x, y) ? 'ring-2 ring-red-600' : ''}
                ${selectedUnit && selectedUnit.position[0] === x && selectedUnit.position[1] === y ? 'ring-2 ring-yellow-400' : ''}
                cursor-pointer
              `}
              onClick={() => handleTileClick(x, y)}
            >
              {tile.unit && (
                <div 
                  className={`
                    absolute inset-0 flex items-center justify-center
                    ${getUnitColor(tile.unit.player)}
                    rounded-full m-1
                    ${tile.unit.hasMoved || tile.unit.hasAttacked ? 'opacity-50' : ''}
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
            </div>
          ))
        ))}
      </div>
      
      <div className="mt-4 bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">How to Play:</h3>
        <ul className="list-disc pl-4 text-sm">
          <li>Click on a unit to select it</li>
          <li>Click on a highlighted tile to move there</li>
          <li>Click on a red-highlighted enemy to attack</li>
          <li>End your turn when you're finished</li>
          <li>Destroy all enemy units to win!</li>
        </ul>
      </div>
    </div>
  );
};

export default Game;