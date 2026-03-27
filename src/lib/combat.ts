import type { Unit, Terrain, Tile } from '../types/game';
import { GRID_SIZE } from './constants';

export const calculateDamage = (attacker: Unit, defender: Unit, defenderTerrain: Terrain): number => {
  const terrainDefense = defender.defense * (defenderTerrain.defenseBonus / 100);
  const damage = Math.max(0, attacker.attack - (defender.defense + terrainDefense));
  return Math.min(defender.health, Math.max(10, damage));
};

export const countPlayerUnits = (grid: Tile[][], player: 'Red' | 'Blue'): number => {
  let count = 0;
  for (let y = 0; y < GRID_SIZE; y++)
    for (let x = 0; x < GRID_SIZE; x++)
      if (grid[y]?.[x]?.unit?.player === player) count++;
  return count;
};
