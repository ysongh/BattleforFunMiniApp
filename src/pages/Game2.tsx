import React, { useState, useEffect } from 'react';
import { Swords, Shield, Target, DollarSign, Flag, Zap } from 'lucide-react';

type TerrainType = 'plain' | 'forest' | 'mountain' | 'city' | 'base';
type UnitType = 'infantry' | 'tank' | 'artillery' | null;
type Player = 1 | 2;

interface Unit {
  type: UnitType;
  player: Player;
  hp: number;
}

interface Tile {
  terrain: TerrainType;
  unit: Unit | null;
  owner: Player | null;
}

interface UnitStats {
  cost: number;
  movement: number;
  minRange: number;
  maxRange: number;
  attack: number;
  defense: number;
}

const UNIT_STATS: Record<string, UnitStats> = {
  infantry: { cost: 1000, movement: 3, minRange: 1, maxRange: 1, attack: 55, defense: 50 },
  tank: { cost: 7000, movement: 6, minRange: 1, maxRange: 1, attack: 85, defense: 70 },
  artillery: { cost: 6000, movement: 5, minRange: 2, maxRange: 3, attack: 90, defense: 40 }
};

const TERRAIN_DEFENSE: Record<TerrainType, number> = {
  plain: 0,
  forest: 20,
  mountain: 30,
  city: 30,
  base: 30
};

const MAX_ACTION_POINTS = 10;
const AP_RECOVERY_INTERVAL = 60000; // 1 minute in milliseconds

const Game2: React.FC = () => {
  const [gridSize] = useState({ width: 12, height: 10 });
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [actionPoints, setActionPoints] = useState<Record<Player, number>>({ 1: 10, 2: 10 });
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [validMoves, setValidMoves] = useState<boolean[][]>([]);
  const [validAttacks, setValidAttacks] = useState<boolean[][]>([]);
  const [gold, setGold] = useState<Record<Player, number>>({ 1: 10000, 2: 10000 });
  const [showBuyMenu, setShowBuyMenu] = useState(false);
  const [buyMenuCell, setBuyMenuCell] = useState<{ x: number; y: number } | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [lastApRecovery, setLastApRecovery] = useState<Record<Player, number>>({ 1: Date.now(), 2: Date.now() });
  const [timeUntilNextAP, setTimeUntilNextAP] = useState<Record<Player, number>>({ 1: 60, 2: 60 });

  useEffect(() => {
    initializeGrid();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newActionPoints = { ...actionPoints };
      const newLastApRecovery = { ...lastApRecovery };
      const newTimeUntilNextAP = { ...timeUntilNextAP };
      let updated = false;

      ([1, 2] as Player[]).forEach(player => {
        const timeSinceLastRecovery = now - lastApRecovery[player];
        
        if (timeSinceLastRecovery >= AP_RECOVERY_INTERVAL) {
          if (newActionPoints[player] < MAX_ACTION_POINTS) {
            newActionPoints[player] = Math.min(MAX_ACTION_POINTS, newActionPoints[player] + 1);
            newLastApRecovery[player] = now;
            updated = true;
          }
        }
        
        const timeLeft = Math.ceil((AP_RECOVERY_INTERVAL - (now - newLastApRecovery[player])) / 1000);
        newTimeUntilNextAP[player] = timeLeft;
      });

      setTimeUntilNextAP(newTimeUntilNextAP);

      if (updated) {
        setActionPoints(newActionPoints);
        setLastApRecovery(newLastApRecovery);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [actionPoints, lastApRecovery]);

  useEffect(() => {
    const incomeInterval = setInterval(() => {
      const newGold = { ...gold };
      
      for (let y = 0; y < gridSize.height; y++) {
        for (let x = 0; x < gridSize.width; x++) {
          if (grid[y] && grid[y][x] && (grid[y][x].terrain === 'city' || grid[y][x].terrain === 'base')) {
            const owner = grid[y][x].owner;
            if (owner) {
              newGold[owner] += 100;
            }
          }
        }
      }
      
      setGold(newGold);
    }, 10000); // Income every 10 seconds

    return () => clearInterval(incomeInterval);
  }, [grid]);

  const initializeGrid = () => {
    const newGrid: Tile[][] = [];
    for (let y = 0; y < gridSize.height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < gridSize.width; x++) {
        let terrain: TerrainType = 'plain';
        let owner: Player | null = null;
        let unit: Unit | null = null;

        if (Math.random() < 0.15) terrain = 'forest';
        if (Math.random() < 0.08) terrain = 'mountain';
        
        if ((x === 2 && y === 2) || (x === 9 && y === 7)) {
          terrain = 'base';
          owner = x === 2 ? 1 : 2;
        }
        
        if ((x === 4 && y === 4) || (x === 7 && y === 5)) {
          terrain = 'city';
        }

        if (x === 2 && y === 2) {
          unit = { type: 'infantry', player: 1, hp: 100 };
        }
        if (x === 9 && y === 7) {
          unit = { type: 'infantry', player: 2, hp: 100 };
        }

        row.push({ terrain, unit, owner });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
  };

  const calculateValidMoves = (x: number, y: number): boolean[][] => {
    const unit = grid[y][x].unit;
    if (!unit) return Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false));

    const moves: boolean[][] = Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false));
    const visited: boolean[][] = Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false));
    const queue: { x: number; y: number; movesLeft: number }[] = [{ x, y, movesLeft: UNIT_STATS[unit.type!].movement }];
    
    visited[y][x] = true;

    while (queue.length > 0) {
      const current = queue.shift()!;
      moves[current.y][current.x] = true;

      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;

        if (nx >= 0 && nx < gridSize.width && ny >= 0 && ny < gridSize.height && !visited[ny][nx]) {
          const targetTile = grid[ny][nx];
          if (!targetTile.unit || (targetTile.unit.player === unit.player)) {
            const moveCost = targetTile.terrain === 'mountain' ? 2 : 1;
            const newMovesLeft = current.movesLeft - moveCost;

            if (newMovesLeft >= 0) {
              visited[ny][nx] = true;
              queue.push({ x: nx, y: ny, movesLeft: newMovesLeft });
            }
          }
        }
      }
    }

    return moves;
  };

  const calculateValidAttacks = (x: number, y: number): boolean[][] => {
    const unit = grid[y][x].unit;
    if (!unit) return Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false));

    const attacks: boolean[][] = Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false));
    const stats = UNIT_STATS[unit.type!];

    for (let ty = 0; ty < gridSize.height; ty++) {
      for (let tx = 0; tx < gridSize.width; tx++) {
        const distance = Math.abs(tx - x) + Math.abs(ty - y);
        const targetUnit = grid[ty][tx].unit;
        
        if (distance >= stats.minRange && distance <= stats.maxRange && targetUnit && targetUnit.player !== unit.player) {
          attacks[ty][tx] = true;
        }
      }
    }

    return attacks;
  };

  const handleCellClick = (x: number, y: number) => {
    const clickedTile = grid[y][x];

    if (showBuyMenu) {
      setShowBuyMenu(false);
      setBuyMenuCell(null);
      return;
    }

    if (clickedTile.terrain === 'base' && clickedTile.owner === currentPlayer && !clickedTile.unit) {
      setShowBuyMenu(true);
      setBuyMenuCell({ x, y });
      return;
    }

    if (selectedCell) {
      const selectedUnit = grid[selectedCell.y][selectedCell.x].unit;

      if (validMoves[y][x] && !clickedTile.unit && selectedUnit?.player === currentPlayer) {
        if (actionPoints[currentPlayer] >= 1) {
          moveUnit(selectedCell.x, selectedCell.y, x, y);
          setActionPoints({ ...actionPoints, [currentPlayer]: actionPoints[currentPlayer] - 1 });
        }
        setSelectedCell(null);
        setValidMoves([]);
        setValidAttacks([]);
        return;
      }

      if (validAttacks[y][x] && selectedUnit?.player === currentPlayer) {
        if (actionPoints[currentPlayer] >= 1) {
          performAttack(selectedCell.x, selectedCell.y, x, y);
          setActionPoints({ ...actionPoints, [currentPlayer]: actionPoints[currentPlayer] - 1 });
        }
        setSelectedCell(null);
        setValidMoves([]);
        setValidAttacks([]);
        return;
      }

      setSelectedCell(null);
      setValidMoves([]);
      setValidAttacks([]);
    }

    if (clickedTile.unit) {
      setSelectedCell({ x, y });
      setValidMoves(calculateValidMoves(x, y));
      setValidAttacks(calculateValidAttacks(x, y));
    }
  };

  const moveUnit = (fromX: number, fromY: number, toX: number, toY: number) => {
    const newGrid = grid.map(row => row.map(cell => ({ ...cell, unit: cell.unit ? { ...cell.unit } : null })));
    const unit = newGrid[fromY][fromX].unit!;
    
    newGrid[toY][toX].unit = { ...unit };
    newGrid[fromY][fromX].unit = null;

    if (newGrid[toY][toX].terrain === 'city' && newGrid[toY][toX].owner !== unit.player) {
      newGrid[toY][toX].owner = unit.player;
    }

    setGrid(newGrid);
  };

  const performAttack = (fromX: number, fromY: number, toX: number, toY: number) => {
    const newGrid = grid.map(row => row.map(cell => ({ ...cell, unit: cell.unit ? { ...cell.unit } : null })));
    const attacker = newGrid[fromY][fromX].unit!;
    const defender = newGrid[toY][toX].unit!;

    const attackerStats = UNIT_STATS[attacker.type!];
    const defenderStats = UNIT_STATS[defender.type!];
    const terrainDefense = TERRAIN_DEFENSE[newGrid[toY][toX].terrain];

    const damage = Math.max(1, Math.floor(
      (attackerStats.attack * (attacker.hp / 100)) - 
      (defenderStats.defense * (defender.hp / 100) * (1 + terrainDefense / 100)) / 2
    ));

    defender.hp = Math.max(0, defender.hp - damage);

    if (defender.hp <= 0) {
      newGrid[toY][toX].unit = null;
    }

    setGrid(newGrid);
  };

  const buyUnit = (unitType: UnitType) => {
    if (!buyMenuCell || !unitType) return;

    const cost = UNIT_STATS[unitType].cost;
    if (gold[currentPlayer] < cost) return;

    const newGrid = grid.map(row => row.map(cell => ({ ...cell, unit: cell.unit ? { ...cell.unit } : null })));
    newGrid[buyMenuCell.y][buyMenuCell.x].unit = {
      type: unitType,
      player: currentPlayer,
      hp: 100
    };

    setGrid(newGrid);
    setGold({ ...gold, [currentPlayer]: gold[currentPlayer] - cost });
    setShowBuyMenu(false);
    setBuyMenuCell(null);
  };

  const switchPlayer = () => {
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    setSelectedCell(null);
    setValidMoves([]);
    setValidAttacks([]);
  };

  const getTerrainColor = (terrain: TerrainType, owner: Player | null) => {
    switch (terrain) {
      case 'plain': return 'bg-green-200';
      case 'forest': return 'bg-green-600';
      case 'mountain': return 'bg-gray-500';
      case 'city': return owner === 1 ? 'bg-blue-400' : owner === 2 ? 'bg-red-400' : 'bg-gray-400';
      case 'base': return owner === 1 ? 'bg-blue-600' : 'bg-red-600';
    }
  };

  const getUnitIcon = (type: UnitType) => {
    switch (type) {
      case 'infantry': return '👤';
      case 'tank': return '🛡️';
      case 'artillery': return '🎯';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-white">Tactical Wars</h1>
            <div className="flex items-center gap-2">
              <Flag className={currentPlayer === 1 ? 'text-blue-400' : 'text-red-400'} />
              <span className="text-white font-bold">Player {currentPlayer}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Zap className="text-blue-400" />
                <span className="text-white font-bold">P1 AP: {actionPoints[1]}/{MAX_ACTION_POINTS}</span>
              </div>
              <span className="text-xs text-gray-400">Next: {timeUntilNextAP[1]}s</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Zap className="text-red-400" />
                <span className="text-white font-bold">P2 AP: {actionPoints[2]}/{MAX_ACTION_POINTS}</span>
              </div>
              <span className="text-xs text-gray-400">Next: {timeUntilNextAP[2]}s</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="text-blue-400" />
              <span className="text-white font-bold">P1: ${gold[1]}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="text-red-400" />
              <span className="text-white font-bold">P2: ${gold[2]}</span>
            </div>
            <button
              onClick={switchPlayer}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded font-bold transition"
            >
              Switch Player
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 inline-block relative">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${gridSize.width}, minmax(0, 1fr))` }}>
            {grid.map((row, y) =>
              row.map((tile, x) => (
                <div
                  key={`${x}-${y}`}
                  onClick={() => handleCellClick(x, y)}
                  className={`
                    w-12 h-12 border border-gray-600 flex items-center justify-center cursor-pointer relative
                    ${getTerrainColor(tile.terrain, tile.owner)}
                    ${selectedCell?.x === x && selectedCell?.y === y ? 'ring-4 ring-yellow-400' : ''}
                    ${validMoves[y]?.[x] ? 'ring-2 ring-blue-400' : ''}
                    ${validAttacks[y]?.[x] ? 'ring-2 ring-red-400' : ''}
                  `}
                >
                  {tile.unit && (
                    <div className={`text-2xl ${tile.unit.player === 1 ? 'filter drop-shadow-[0_0_2px_rgba(59,130,246,1)]' : 'filter drop-shadow-[0_0_2px_rgba(239,68,68,1)]'}`}>
                      {getUnitIcon(tile.unit.type)}
                    </div>
                  )}
                  {tile.unit && (
                    <div className="absolute bottom-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                      {tile.unit.hp}
                    </div>
                  )}
                  {tile.terrain === 'city' && !tile.unit && (
                    <div className="text-xl">🏛️</div>
                  )}
                  {tile.terrain === 'base' && !tile.unit && (
                    <div className="text-xl">🏭</div>
                  )}
                </div>
              ))
            )}
          </div>

          {showBuyMenu && buyMenuCell && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-700 rounded-lg p-4 shadow-2xl z-10">
              <h3 className="text-white font-bold mb-4">Buy Unit</h3>
              <div className="space-y-2">
                {Object.entries(UNIT_STATS).map(([type, stats]) => (
                  <button
                    key={type}
                    onClick={() => buyUnit(type as UnitType)}
                    disabled={gold[currentPlayer] < stats.cost}
                    className={`w-full text-left px-4 py-2 rounded flex items-center justify-between ${
                      gold[currentPlayer] >= stats.cost
                        ? 'bg-gray-600 hover:bg-gray-500 text-white'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xl">{getUnitIcon(type as UnitType)}</span>
                      <span className="capitalize">{type}</span>
                    </span>
                    <span>${stats.cost}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowBuyMenu(false);
                  setBuyMenuCell(null);
                }}
                className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mt-4 text-white">
          <h3 className="font-bold mb-2">How to Play:</h3>
          <ul className="text-sm space-y-1 text-gray-300">
            <li>• Each action (move or attack) costs 1 Action Point (AP)</li>
            <li>• Action Points regenerate automatically - 1 AP every 60 seconds</li>
            <li>• Maximum of 10 AP per player</li>
            <li>• Click any unit to see movement range (blue) and attack range (red)</li>
            <li>• Click your base to buy units when it's empty</li>
            <li>• Capture cities for passive income ($100 every 10 seconds)</li>
            <li>• Use "Switch Player" button to control the other player</li>
            <li>• Infantry: Cheap scouts | Tank: Heavy hitters | Artillery: Long-range</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Game2;