

export enum CardType {
  PLANT = 'PLANT',
  POWER = 'POWER',
}

export enum PowerCardName {
  STEAL = 'Steal',
  HIPPIE_POWER = 'Hippie Power',
  BUSTED = 'Busted',
  COMPOST = 'Compost',
  POTZILLA = 'Potzilla',
  DANDELION = 'Dandelion',
  WEED_KILLER = 'Weed Killer',
}

export interface CardBase {
  id: string;
  type: CardType;
  description: string;
}

export interface PlantCard extends CardBase {
  type: CardType.PLANT;
  plants: number;
  originalPlants: number; // To remember base value before compost
}

export interface PowerCard extends CardBase {
  type: CardType.POWER;
  name: PowerCardName;
}

export type GameCard = PlantCard | PowerCard;

export interface Pot {
  id: string;
  card: GameCard | null; // PlantCard or DandelionCard (which is a PowerCard)
}

export interface Player {
  id: string; // For multiplayer, this will be the socket ID on the server
  name: string;
  hand: GameCard[];
  pots: Pot[];
  score: number;
  isSkipped: boolean;
  roundScore: number;
  isHost?: boolean; // Optional: to identify the host in a room
}

export enum GamePhase {
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  TARGETING_PLAYER = 'TARGETING_PLAYER',
  TARGETING_PLAYER_POT = 'TARGETING_PLAYER_POT',
  TARGETING_SELF_POT = 'TARGETING_SELF_POT',
  ROUND_OVER = 'ROUND_OVER',
  GAME_OVER = 'GAME_OVER',
  MULTIPLAYER_LOBBY = 'MULTIPLAYER_LOBBY', // New phase for lobby
  MULTIPLAYER_WAITING = 'MULTIPLAYER_WAITING', // New phase for waiting room
}

export interface TargetSelection {
  cardPlayed: GameCard;
  sourcePlayerId: string;
  targetType: 'player' | 'player_pot' | 'self_pot_plant' | 'self_pot_dandelion' | 'self_pot_empty' | 'opponent_pot_empty' | 'any_empty_pot';
  onSelect: (targetId: string, potIndex?: number) => void; // targetId can be playerId or potId
  message: string;
  allowedPotContent?: 'plant' | 'dandelion' | 'any_filled' | 'empty'; // For pot targeting
}

export interface GameState {
  gameId?: string; // For multiplayer rooms
  players: Player[];
  drawPile: GameCard[];
  discardPile: GameCard[];
  currentPlayerIndex: number;
  gamePhase: GamePhase;
  roundWinner: Player | null;
  gameWinner: Player | null;
  gameLog: string[];
  message: string; // General messages/errors
  targetSelection: TargetSelection | null;
  turnActionDone: boolean; // true if player has played a card or taken an action this turn
}

// Types for server-client communication
export interface PlayerActionPayload {
  actionType: 'play_card' | 'discard_card';
  cardId: string;
  // For playing a card, these might be needed depending on the card
  targetPlayerId?: string; // For player-targeting cards or targeting another player's pot
  potIndex?: number;       // For pot-targeting cards
  selfPotIndex?: number;   // For cards like Steal that need a self pot
}

export interface ClientToServerEvents {
  'host-game': (playerName: string, callback: (response: { gameId: string; playerId: string, initialGameState: GameState }) => void) => void;
  'join-game': (data: { gameId: string; playerName: string }, callback: (response: { success: boolean; message: string; gameState?: GameState, playerId?: string }) => void) => void;
  'player-action': (data: { gameId: string; playerId: string; action: PlayerActionPayload }) => void;
  'start-game-request': (data: {gameId: string, playerId: string}) => void;
  'request-game-state': (gameId: string) => void; // For re-syncing if needed
  'start-next-round': (data: { gameId: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  'player-joined-room': (data: { gameState: GameState }) => void;
  'player-left-room': (data: { gameState: GameState, message: string }) => void;
  'game-started': (gameState: GameState) => void;
  'game-state-update': (gameState: GameState) => void;
  'error-message': (data: { message: string }) => void;
  'game-not-found': () => void;
  'room-full': () => void;
}