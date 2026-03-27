import type { UnitType, Player, Unit } from '../types/game';
import { UNIT_TYPES } from './constants';

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const createUnit = (type: UnitType, position: [number, number], player: Player): Unit => ({
  id: generateId(),
  position,
  player,
  ...UNIT_TYPES[type],
});
