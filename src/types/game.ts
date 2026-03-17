export type UnitType = 'Infantry' | 'Tank' | 'Artillery';
export type TerrainType = 'Plain' | 'Mountain' | 'Forest' | 'City' | 'Road';
export type Player = 'Red' | 'Blue';

export interface Terrain {
  type: TerrainType;
  defenseBonus: number;
  movementCost: number;
  isCity?: boolean;
}

export interface City extends Terrain {
  owner: Player | null;
  captureProgress: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  health: number;
  attack: number;
  defense: number;
  moveRange: number;
  attackRange: number;
  position: [number, number];
  player: Player;
}

export interface Tile {
  position: [number, number];
  terrain: Terrain;
  unit: Unit | null;
}
