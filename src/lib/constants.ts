import type { UnitType, Terrain, TerrainType, Unit } from '../types/game';

export let GRID_SIZE = 10;

/** Update the active grid size. Call before generating a new grid; downstream
 *  modules read GRID_SIZE via live ES module bindings and see the new value. */
export function setGridSize(n: number) {
  GRID_SIZE = n;
}
export const COOLDOWN_DURATION = 10000; // 10 seconds
export const AP_REGEN_INTERVAL = 10000; // 1 AP every 10 seconds
export const AI_ACTION_INTERVAL = 3000; // AI tries to act every 3 seconds
export const MAX_AP = 10;

export const UNIT_COSTS: Record<UnitType, number> = {
  Infantry: 100,
  Tank: 300,
  Artillery: 250,
  Chopper: 400,
};

export const UNIT_TYPES: Record<UnitType, Omit<Unit, 'id' | 'position' | 'player'>> = {
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
  Chopper: {
    type: 'Chopper',
    health: 100,
    attack: 65,
    defense: 15,
    moveRange: 6,
    attackRange: 2,
  },
};

export const TERRAIN_TYPES: Record<TerrainType, Terrain> = {
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
  Water: { type: 'Water', defenseBonus: 0, movementCost: 4 },
};
