import type { Unit, Tile } from '../types/game';
import { GRID_SIZE } from './constants';
import { calculateDamage } from './combat';

interface AIContext {
  grid: Tile[][];
  actionPoints: number;
  cooldowns: Record<string, number>;
  difficulty: 'easy' | 'medium' | 'hard';
}

type AIAction = {
  type: 'attack';
  unit: Unit;
  targetX: number;
  targetY: number;
  damage: number;
  newGrid: Tile[][];
} | {
  type: 'move';
  unit: Unit;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  newGrid: Tile[][];
};

export const computeAIAction = (ctx: AIContext): AIAction | null => {
  const { grid, actionPoints, cooldowns, difficulty } = ctx;
  const currentTime = Date.now();

  if (actionPoints <= 0 || grid.length === 0) return null;

  // Find available Blue units (not on cooldown)
  const available: { unit: Unit; x: number; y: number }[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const unit = grid[y][x].unit;
      if (unit?.player === 'Blue') {
        const cd = cooldowns[unit.id];
        if (!cd || currentTime >= cd) {
          available.push({ unit, x, y });
        }
      }
    }
  }
  if (available.length === 0) return null;

  // Find all Red units
  const redUnits: { unit: Unit; x: number; y: number }[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const unit = grid[y][x].unit;
      if (unit?.player === 'Red') redUnits.push({ unit, x, y });
    }
  }
  if (redUnits.length === 0) return null;

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
  const newGrid: Tile[][] = grid.map(row =>
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
        const dmg = calculateDamage(unit, t.unit, grid[t.y][t.x].terrain);
        const bestDmg = calculateDamage(unit, best.unit, grid[best.y][best.x].terrain);
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

    return { type: 'attack', unit, targetX: target.x, targetY: target.y, damage, newGrid };
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

  if (validMoves.length === 0) return null;

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

  return { type: 'move', unit, fromX: ux, fromY: uy, toX: bestPos[0], toY: bestPos[1], newGrid };
};
