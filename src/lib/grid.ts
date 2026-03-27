import type { TerrainType, City, Player, Unit, Tile } from '../types/game';
import { GRID_SIZE, TERRAIN_TYPES } from './constants';

export const getTerrainColor = (terrain: TerrainType): string => {
  switch (terrain) {
    case 'Plain': return 'bg-green-200';
    case 'Mountain': return 'bg-gray-500';
    case 'Forest': return 'bg-green-600';
    case 'City': return 'bg-yellow-200';
    case 'Road': return 'bg-yellow-600';
    default: return 'bg-green-200';
  }
};

export const getUnitColor = (player: Player): string => {
  return player === 'Red' ? 'bg-red-500' : 'bg-blue-500';
};

export const getCityOwnerColor = (city: City): string => {
  if (!city.owner) return 'border-gray-600';
  return city.owner === 'Red' ? 'border-red-600' : 'border-blue-600';
};

export const generateInitialGrid = (): Tile[][] => {
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

export const calculateMovementRange = (unit: Unit, grid: Tile[][]): [number, number][] => {
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

export const calculateAttackRange = (unit: Unit, grid: Tile[][]): [number, number][] => {
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

export const findEnemiesInRange = (unit: Unit, ux: number, uy: number, grid: Tile[][]): { unit: Unit; x: number; y: number }[] => {
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
