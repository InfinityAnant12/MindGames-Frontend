import { PlantCard, PowerCard, CardType, PowerCardName, GameCard } from './types';
import { v4 as uuidv4 } from 'uuid';

export const MAX_PLAYERS = 5;
export const MIN_PLAYERS = 2;
export const NUM_POTS = 5;
export const STARTING_HAND_SIZE = 5;
export const WINNING_SCORE = 50;

// Helper function for creating plant card definitions (without id)
const createPlantCardDefinition = (plants: number, description: string): Omit<PlantCard, 'id'> => ({
  type: CardType.PLANT,
  plants,
  originalPlants: plants, // originalPlants is same as plants for base definition
  description,
});

// Helper function for creating power card definitions (without id)
const createPowerCardDefinition = (name: PowerCardName, description: string): Omit<PowerCard, 'id'> => ({
  type: CardType.POWER,
  name,
  description,
});

// These functions create full card objects with IDs, might be useful for dynamic card generation elsewhere.
// Not currently used for initial deck creation.
export const createPlantCard = (plants: number, description?: string): PlantCard => ({
  id: uuidv4(),
  type: CardType.PLANT,
  plants,
  originalPlants: plants,
  description: description || `${plants} Weed Plant${plants > 1 ? 's' : ''}`,
});

export const createPowerCard = (name: PowerCardName, description: string): PowerCard => ({
  id: uuidv4(),
  type: CardType.POWER,
  name,
  description,
});

export const PLANT_CARD_DEFINITIONS: Omit<PlantCard, 'id'>[] = [
  ...Array(6).fill(null).map(() => createPlantCardDefinition(1, '1 Weed Plant. Grow the basics.')),
  ...Array(8).fill(null).map(() => createPlantCardDefinition(2, '2 Weed Plants. Nice buds!')),
  ...Array(7).fill(null).map(() => createPlantCardDefinition(3, '3 Weed Plants. Getting strong!')),
  ...Array(5).fill(null).map(() => createPlantCardDefinition(4, '4 Weed Plants. Dank stuff.')),
  ...Array(2).fill(null).map(() => createPlantCardDefinition(5, '5 Weed Plants. Super harvest!')),
  ...Array(1).fill(null).map(() => createPlantCardDefinition(6, '6 Weed Plants. Legendary yield!')),
];

export const POWER_CARD_DEFINITIONS: Omit<PowerCard, 'id'>[] = [
  ...Array(5).fill(null).map(() => createPowerCardDefinition(PowerCardName.STEAL, 'Steal one full pot from another player (if you have an empty pot).')),
  ...Array(4).fill(null).map(() => createPowerCardDefinition(PowerCardName.HIPPIE_POWER, 'Destroy the smallest weed plant pot of a target player.')),
  ...Array(3).fill(null).map(() => createPowerCardDefinition(PowerCardName.BUSTED, 'Destroy the largest weed plant pot of a target player and skip their next turn.')),
  ...Array(2).fill(null).map(() => createPowerCardDefinition(PowerCardName.COMPOST, 'Double the plant count of any one of your own weed plant pots.')),
  ...Array(1).fill(null).map(() => createPowerCardDefinition(PowerCardName.POTZILLA, 'Destroys all pots of a targeted player.')),
  ...Array(7).fill(null).map(() => createPowerCardDefinition(PowerCardName.DANDELION, 'Occupies one pot; adds no score and blocks win condition. Pesky weed!')),
  ...Array(7).fill(null).map(() => createPowerCardDefinition(PowerCardName.WEED_KILLER, 'Remove a Dandelion from one of your pots.')),
];

export const INITIAL_DECK: GameCard[] = [
  ...PLANT_CARD_DEFINITIONS.map(def => ({ ...def, id: uuidv4() } as PlantCard)),
  ...POWER_CARD_DEFINITIONS.map(def => ({ ...def, id: uuidv4() } as PowerCard)),
];