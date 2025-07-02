

import { GameCard, Player, Pot, GameState, CardType, PowerCardName, PlantCard, PowerCard, GamePhase, TargetSelection } from '../types';
import { INITIAL_DECK, NUM_POTS, STARTING_HAND_SIZE, WINNING_SCORE } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// Fisher-Yates shuffle
const shuffleDeck = <T,>(array: T[]): T[] => {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
};

export const createInitialPlayer = (id: string, name: string): Player => ({
  id,
  name,
  hand: [],
  pots: Array(NUM_POTS).fill(null).map((_, i) => ({ id: `pot-${id}-${i}`, card: null })),
  score: 0,
  isSkipped: false,
  roundScore: 0,
});

export const initializeGame = (numPlayers: number, humanPlayerName: string): GameState => {
  const players: Player[] = Array(numPlayers).fill(null).map((_, i) => {
    const playerName = i === 0 ? humanPlayerName : `Player ${i + 1}`;
    return createInitialPlayer(uuidv4(), playerName);
  });
  let deck = shuffleDeck([...INITIAL_DECK.map(card => ({...card, id: uuidv4()}))]); 

  players.forEach(player => {
    for (let i = 0; i < STARTING_HAND_SIZE; i++) {
      if (deck.length > 0) {
        player.hand.push(deck.pop()!);
      }
    }
  });

  const firstPlayerName = players.length > 0 ? players[0].name : "Player 1";

  return {
    players,
    drawPile: deck,
    discardPile: [],
    currentPlayerIndex: 0,
    gamePhase: GamePhase.PLAYING,
    roundWinner: null,
    gameWinner: null,
    gameLog: [`Game started with ${numPlayers} players. ${humanPlayerName} is Player 1.`],
    message: `${firstPlayerName}'s turn. Select a card or action.`,
    targetSelection: null,
    turnActionDone: false,
  };
};

export const addLogEntry = (gameState: GameState, entry: string): GameState => {
  const currentGameLog = gameState.gameLog || [];
  return { ...gameState, gameLog: [...currentGameLog, entry].slice(-20) }; 
};

const drawCardAfterPlay = (gameState: GameState, playerId: string): GameState => {
  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return newState; 

  const player = newState.players[playerIndex];

  if (newState.drawPile.length > 0) {
    const modifiablePlayer = { ...player, hand: [...player.hand] };
    const modifiableDrawPile = [...newState.drawPile];

    const drawnCard = modifiableDrawPile.pop()!;
    modifiablePlayer.hand.push(drawnCard);

    const updatedPlayers = [...newState.players];
    updatedPlayers[playerIndex] = modifiablePlayer;

    newState = {
      ...newState,
      players: updatedPlayers,
      drawPile: modifiableDrawPile,
    };
    newState = addLogEntry(newState, `${modifiablePlayer.name} drew a card from the draw pile.`);
  } else {
    newState = addLogEntry(newState, `${player.name} would draw a card, but the draw pile is empty.`);
  }
  return newState;
};

export const discardCardLogic = (gameState: GameState, playerId: string, cardId: string): GameState => {
  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return addLogEntry(newState, "Error: Player not found for discard.");

  const playerToUpdate = { ...newState.players[playerIndex] }; // Use a new variable name for clarity
  playerToUpdate.hand = [...playerToUpdate.hand]; 
  newState.discardPile = [...newState.discardPile];

  const cardIndexInHand = playerToUpdate.hand.findIndex(c => c.id === cardId);
  if (cardIndexInHand === -1) return addLogEntry(newState, "Error: Card not found in hand to discard.");

  const cardToDiscard = playerToUpdate.hand[cardIndexInHand];
  playerToUpdate.hand.splice(cardIndexInHand, 1);
  newState.discardPile.push(cardToDiscard);

  newState.players[playerIndex] = playerToUpdate; // Assign the updated player object back
  const cardName = cardToDiscard.type === CardType.PLANT ? `${(cardToDiscard as PlantCard).originalPlants}-plant` : (cardToDiscard as PowerCard).name;
  newState = addLogEntry(newState, `${playerToUpdate.name} discarded ${cardName}.`);
  
  // Player draws a new card after discarding, if available
  newState = drawCardAfterPlay(newState, playerId);

  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING; 
  newState.targetSelection = null; 
  newState.message = `${playerToUpdate.name} discarded a card and drew a new one. Waiting for next player...`;
  
  return newState;
};


export const playPlantCardLogic = (gameState: GameState, playingPlayerId: string, cardId: string, targetPotOwnerId: string, potIndex: number): GameState => {
  let newState = { ...gameState };
  const playingPlayerIndex = newState.players.findIndex(p => p.id === playingPlayerId);
  const targetPotOwnerIndex = newState.players.findIndex(p => p.id === targetPotOwnerId);

  if (playingPlayerIndex === -1) return addLogEntry(newState, "Error: Playing player not found.");
  if (targetPotOwnerIndex === -1) return addLogEntry(newState, "Error: Target pot owner not found.");

  const playingPlayer = { ...newState.players[playingPlayerIndex] };
  playingPlayer.hand = [...playingPlayer.hand]; 
  
  const targetPotOwner = { ...newState.players[targetPotOwnerIndex] };
  const finalTargetPotOwnerRef = (playingPlayerId === targetPotOwnerId) ? playingPlayer : targetPotOwner;
  finalTargetPotOwnerRef.pots = finalTargetPotOwnerRef.pots.map(p => ({...p})); 


  const cardIndex = playingPlayer.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return addLogEntry(newState, "Error: Card not found in hand.");
  
  const cardToPlay = playingPlayer.hand[cardIndex] as PlantCard;
  if (cardToPlay.type !== CardType.PLANT) return addLogEntry(newState, "Error: Not a plant card.");

  if (finalTargetPotOwnerRef.pots[potIndex].card) return addLogEntry(newState, `Error: Pot ${potIndex + 1} of ${finalTargetPotOwnerRef.name} is already full.`);

  playingPlayer.hand.splice(cardIndex, 1); 
  const freshPlantCard = {...cardToPlay, plants: cardToPlay.originalPlants}; 
  finalTargetPotOwnerRef.pots[potIndex] = { ...finalTargetPotOwnerRef.pots[potIndex], card: freshPlantCard };
  
  newState.players[playingPlayerIndex] = playingPlayer;
  if (playingPlayerId !== targetPotOwnerId) { 
      newState.players[targetPotOwnerIndex] = finalTargetPotOwnerRef;
  }
  
  const logMessage = playingPlayerId === targetPotOwnerId 
    ? `${playingPlayer.name} planted a ${cardToPlay.originalPlants}-plant card in their pot ${potIndex + 1}.`
    : `${playingPlayer.name} planted a ${cardToPlay.originalPlants}-plant card in ${finalTargetPotOwnerRef.name}'s pot ${potIndex + 1}.`;
  newState = addLogEntry(newState, logMessage);
  
  newState = drawCardAfterPlay(newState, playingPlayerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${playingPlayer.name} played a card. Waiting for next player...`;
  return newState;
};

export const playDandelionCardLogic = (gameState: GameState, playingPlayerId: string, cardId: string, targetPotOwnerId: string, potIndex: number): GameState => {
  let newState = { ...gameState };
  const playingPlayerIndex = newState.players.findIndex(p => p.id === playingPlayerId);
  const targetPotOwnerIndex = newState.players.findIndex(p => p.id === targetPotOwnerId);

  if (playingPlayerIndex === -1) return addLogEntry(newState, "Error: Playing player not found.");
  if (targetPotOwnerIndex === -1) return addLogEntry(newState, "Error: Target pot owner not found.");

  if (playingPlayerId === targetPotOwnerId) { 
    return addLogEntry(newState, "Error: Dandelion cannot be played on your own pot.");
  }

  const playingPlayer = { ...newState.players[playingPlayerIndex] };
  playingPlayer.hand = [...playingPlayer.hand];
  
  const targetPotOwner = { ...newState.players[targetPotOwnerIndex] };
  const finalTargetPotOwnerRef = (playingPlayerId === targetPotOwnerId) ? playingPlayer : targetPotOwner; 
  finalTargetPotOwnerRef.pots = finalTargetPotOwnerRef.pots.map(p => ({...p}));


  const cardIndex = playingPlayer.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return addLogEntry(newState, "Error: Card not found in hand.");

  const cardToPlay = playingPlayer.hand[cardIndex] as PowerCard;
  if (cardToPlay.name !== PowerCardName.DANDELION) return addLogEntry(newState, "Error: Not a Dandelion card.");

  if (finalTargetPotOwnerRef.pots[potIndex].card) return addLogEntry(newState, `Error: Pot ${potIndex + 1} of ${finalTargetPotOwnerRef.name} is already full.`);

  playingPlayer.hand.splice(cardIndex, 1);
  finalTargetPotOwnerRef.pots[potIndex] = { ...finalTargetPotOwnerRef.pots[potIndex], card: cardToPlay };
  
  newState.players[playingPlayerIndex] = playingPlayer;
   if (playingPlayerId !== targetPotOwnerId) {
      newState.players[targetPotOwnerIndex] = finalTargetPotOwnerRef;
  }

  const logMessage = `${playingPlayer.name} planted a Dandelion in ${finalTargetPotOwnerRef.name}'s pot ${potIndex + 1}.`;
  newState = addLogEntry(newState, logMessage);

  newState = drawCardAfterPlay(newState, playingPlayerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${playingPlayer.name} played a card. Waiting for next player...`;
  return newState;
};

export const playWeedKillerLogic = (gameState: GameState, playerId: string, cardId: string, potIndex: number): GameState => {
  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return addLogEntry(newState, "Error: Player not found.");

  const player = { ...newState.players[playerIndex] };
  player.hand = [...player.hand];
  player.pots = player.pots.map(p => ({...p}));
  newState.discardPile = [...newState.discardPile];


  const cardIndexInHand = player.hand.findIndex(c => c.id === cardId);
  if (cardIndexInHand === -1) return addLogEntry(newState, "Error: Card not found in hand.");
  
  const weedKillerCard = player.hand[cardIndexInHand];
  const potCard = player.pots[potIndex].card;

  if (!potCard || !(potCard.type === CardType.POWER && (potCard as PowerCard).name === PowerCardName.DANDELION)) {
    return addLogEntry(newState, "Error: Pot does not contain a Dandelion.");
  }

  player.hand.splice(cardIndexInHand, 1);
  newState.discardPile.push(weedKillerCard, potCard); 
  player.pots[potIndex] = { ...player.pots[potIndex], card: null };
  
  newState.players[playerIndex] = player;
  newState = addLogEntry(newState, `${player.name} used Weed Killer on pot ${potIndex + 1}, removing a Dandelion.`);
  newState = drawCardAfterPlay(newState, playerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${player.name} played a card. Waiting for next player...`;
  return newState;
};

export const playCompostLogic = (gameState: GameState, playerId: string, cardId: string, potIndex: number): GameState => {
  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return addLogEntry(newState, "Error: Player not found.");

  const player = { ...newState.players[playerIndex] };
  player.hand = [...player.hand];
  player.pots = player.pots.map(p => ({...p, card: p.card ? {...p.card} : null } as Pot)); 
  newState.discardPile = [...newState.discardPile];

  const cardIndexInHand = player.hand.findIndex(c => c.id === cardId);
  if (cardIndexInHand === -1) return addLogEntry(newState, "Error: Card not found in hand.");
  
  const compostCard = player.hand[cardIndexInHand];
  const pot = player.pots[potIndex];

  if (!pot.card || pot.card.type !== CardType.PLANT) {
    return addLogEntry(newState, "Error: Pot does not contain a weed plant card.");
  }

  const plantInPot = pot.card as PlantCard;
  const doubledPlants = plantInPot.plants * 2;

  player.hand.splice(cardIndexInHand, 1);
  newState.discardPile.push(compostCard);
  
  player.pots[potIndex].card = { ...plantInPot, plants: doubledPlants };
  
  newState.players[playerIndex] = player;
  newState = addLogEntry(newState, `${player.name} used Compost on pot ${potIndex + 1}. Plants increased from ${plantInPot.plants} to ${doubledPlants}.`);
  newState = drawCardAfterPlay(newState, playerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${player.name} played a card. Waiting for next player...`;
  return newState;
};

export const playStealLogic = (gameState: GameState, playerId: string, cardId: string, targetPlayerId: string, targetPotIndex: number, selfPotIndex: number): GameState => {
  if (playerId === targetPlayerId) {
    return addLogEntry(gameState, "Error: Steal card must target another player.");
  }
  
  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  const targetPlayerIndex = newState.players.findIndex(p => p.id === targetPlayerId);

  if (playerIndex === -1 || targetPlayerIndex === -1) return addLogEntry(newState, "Error: Player or target player not found.");

  let player = { ...newState.players[playerIndex] };
  player.hand = [...player.hand];
  player.pots = player.pots.map(p => ({...p}));

  let targetPlayer = { ...newState.players[targetPlayerIndex] };
  targetPlayer.pots = targetPlayer.pots.map(p => ({...p}));
  
  newState.discardPile = [...newState.discardPile];

  const cardIndexInHand = player.hand.findIndex(c => c.id === cardId);
  if (cardIndexInHand === -1) return addLogEntry(newState, "Error: Steal card not found in hand.");
  const stealCard = player.hand[cardIndexInHand];

  const targetPot = targetPlayer.pots[targetPotIndex];
  if (!targetPot.card || (targetPot.card.type === CardType.POWER && (targetPot.card as PowerCard).name === PowerCardName.DANDELION)) {
      return addLogEntry(newState, "Error: Target pot is empty or has a Dandelion.");
  }
  if (player.pots[selfPotIndex].card) {
      return addLogEntry(newState, "Error: Your chosen pot is not empty.");
  }

  const stolenCard = targetPot.card; 
  targetPlayer.pots[targetPotIndex] = { ...targetPlayer.pots[targetPotIndex], card: null };
  player.pots[selfPotIndex] = { ...player.pots[selfPotIndex], card: stolenCard };
  
  player.hand.splice(cardIndexInHand, 1);
  newState.discardPile.push(stealCard);
  
  newState.players[playerIndex] = player;
  newState.players[targetPlayerIndex] = targetPlayer;

  newState = addLogEntry(newState, `${player.name} stole pot ${targetPotIndex + 1} (${(stolenCard as PlantCard).plants} plants) from ${targetPlayer.name} and placed it in their pot ${selfPotIndex + 1}.`);
  newState = drawCardAfterPlay(newState, playerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${player.name} played a card. Waiting for next player...`;
  return newState;
};

export const playHippiePowerLogic = (gameState: GameState, playerId: string, cardId: string, targetPlayerId: string): GameState => {
  if (playerId === targetPlayerId) {
    return addLogEntry(gameState, "Error: Hippie Power card must target another player.");
  }

  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  const targetPlayerIndex = newState.players.findIndex(p => p.id === targetPlayerId);

  if (playerIndex === -1 || targetPlayerIndex === -1) return addLogEntry(newState, "Error: Player or target player not found.");

  let player = { ...newState.players[playerIndex] };
  player.hand = [...player.hand];

  let targetPlayer = { ...newState.players[targetPlayerIndex] };
  targetPlayer.pots = targetPlayer.pots.map(p => ({...p}));

  newState.discardPile = [...newState.discardPile];
  
  const cardIndexInHand = player.hand.findIndex(c => c.id === cardId);
  if (cardIndexInHand === -1) return addLogEntry(newState, "Error: Hippie Power card not found in hand.");
  const hippiePowerCard = player.hand[cardIndexInHand];
  player.hand.splice(cardIndexInHand, 1); 
  newState.discardPile.push(hippiePowerCard);


  let smallestPlantPotIndex = -1;
  let smallestPlantValue = Infinity;

  targetPlayer.pots.forEach((pot, index) => {
    if (pot.card && pot.card.type === CardType.PLANT) {
      if ((pot.card as PlantCard).plants < smallestPlantValue) {
        smallestPlantValue = (pot.card as PlantCard).plants;
        smallestPlantPotIndex = index;
      }
    }
  });

  if (smallestPlantPotIndex === -1) {
    newState = addLogEntry(newState, `${player.name} used Hippie Power on ${targetPlayer.name}, but they had no weed plants to destroy.`);
  } else {
    const destroyedCard = targetPlayer.pots[smallestPlantPotIndex].card!;
    targetPlayer.pots[smallestPlantPotIndex] = { ...targetPlayer.pots[smallestPlantPotIndex], card: null };
    newState.discardPile.push(destroyedCard);
    newState = addLogEntry(newState, `${player.name} used Hippie Power on ${targetPlayer.name}, destroying their ${smallestPlantValue}-plant pot.`);
  }
  
  newState.players[playerIndex] = player;
  newState.players[targetPlayerIndex] = targetPlayer;
  newState = drawCardAfterPlay(newState, playerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${player.name} played a card. Waiting for next player...`;
  return newState;
};

export const playBustedLogic = (gameState: GameState, playerId: string, cardId: string, targetPlayerId: string): GameState => {
  if (playerId === targetPlayerId) {
    return addLogEntry(gameState, "Error: Busted card must target another player.");
  }

  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  const targetPlayerIndex = newState.players.findIndex(p => p.id === targetPlayerId);

  if (playerIndex === -1 || targetPlayerIndex === -1) return addLogEntry(newState, "Error: Player or target player not found.");

  let player = { ...newState.players[playerIndex] };
  player.hand = [...player.hand];

  let targetPlayer = { ...newState.players[targetPlayerIndex] };
  targetPlayer.pots = targetPlayer.pots.map(p => ({...p}));
  
  newState.discardPile = [...newState.discardPile];

  const cardIndexInHand = player.hand.findIndex(c => c.id === cardId);
  if (cardIndexInHand === -1) return addLogEntry(newState, "Error: Busted card not found in hand.");
  const bustedCard = player.hand[cardIndexInHand];
  player.hand.splice(cardIndexInHand, 1); 
  newState.discardPile.push(bustedCard);

  let largestPlantPotIndex = -1;
  let largestPlantValue = -Infinity;

  targetPlayer.pots.forEach((pot, index) => {
    if (pot.card && pot.card.type === CardType.PLANT) {
      if ((pot.card as PlantCard).plants > largestPlantValue) {
        largestPlantValue = (pot.card as PlantCard).plants;
        largestPlantPotIndex = index;
      }
    }
  });
  
  targetPlayer.isSkipped = true; 

  if (largestPlantPotIndex === -1) {
     newState = addLogEntry(newState, `${player.name} used Busted on ${targetPlayer.name}. They had no plants, but still skip their next turn.`);
  } else {
    const destroyedCard = targetPlayer.pots[largestPlantPotIndex].card!;
    targetPlayer.pots[largestPlantPotIndex] = { ...targetPlayer.pots[largestPlantPotIndex], card: null };
    newState.discardPile.push(destroyedCard);
    newState = addLogEntry(newState, `${player.name} used Busted on ${targetPlayer.name}, destroying their ${largestPlantValue}-plant pot. ${targetPlayer.name} skips next turn.`);
  }
  
  newState.players[playerIndex] = player;
  newState.players[targetPlayerIndex] = targetPlayer;
  newState = drawCardAfterPlay(newState, playerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${player.name} played a card. Waiting for next player...`;
  return newState;
};

export const playPotzillaLogic = (gameState: GameState, playerId: string, cardId: string, targetPlayerId: string): GameState => {
  if (playerId === targetPlayerId) {
    return addLogEntry(gameState, "Error: Potzilla card must target another player.");
  }
  
  let newState = { ...gameState };
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  const targetPlayerIndex = newState.players.findIndex(p => p.id === targetPlayerId);

  if (playerIndex === -1 || targetPlayerIndex === -1) return addLogEntry(newState, "Error: Player or target player not found.");

  let player = { ...newState.players[playerIndex] };
  player.hand = [...player.hand];

  let targetPlayer = { ...newState.players[targetPlayerIndex] };
  targetPlayer.pots = targetPlayer.pots.map(p => ({...p}));

  newState.discardPile = [...newState.discardPile];
  
  const cardIndexInHand = player.hand.findIndex(c => c.id === cardId);
  if (cardIndexInHand === -1) return addLogEntry(newState, "Error: Potzilla card not found in hand.");
  const potzillaCard = player.hand[cardIndexInHand];
  player.hand.splice(cardIndexInHand, 1); 
  newState.discardPile.push(potzillaCard);


  const destroyedPotsContent: GameCard[] = [];
  targetPlayer.pots.forEach(pot => {
    if (pot.card) destroyedPotsContent.push(pot.card);
  });
  
  if(destroyedPotsContent.length === 0){
    newState = addLogEntry(newState, `${player.name} used Potzilla on ${targetPlayer.name}, but they had no plants or dandelions to destroy.`);
  } else {
    targetPlayer.pots = targetPlayer.pots.map(pot => ({ ...pot, card: null }));
    newState.discardPile.push(...destroyedPotsContent);
    newState = addLogEntry(newState, `${player.name} unleashed Potzilla on ${targetPlayer.name}, destroying all their pots!`);
  }

  newState.players[playerIndex] = player;
  newState.players[targetPlayerIndex] = targetPlayer;
  newState = drawCardAfterPlay(newState, playerId);
  newState.turnActionDone = true;
  newState.gamePhase = GamePhase.PLAYING;
  newState.targetSelection = null;
  newState.message = `${player.name} played a card. Waiting for next player...`;
  return newState;
};


export const calculateRoundScores = (gameState: GameState): GameState => {
  let newState = { ...gameState };
  newState.players = newState.players.map(player => {
    const roundScore = player.pots.reduce((sum, pot) => {
      if (pot.card && pot.card.type === CardType.PLANT) {
        return sum + (pot.card as PlantCard).plants;
      }
      return sum;
    }, 0);
    return { ...player, roundScore };
  });
  return newState;
};

export const determineRoundWinner = (gameState: GameState): GameState => {
  let newState = { ...gameState };
  let maxRoundScore = -1;
  let currentRoundWinners: Player[] = [];

  newState.players = newState.players.map(p => {
    const currentRoundScoreValue = p.roundScore || 0; 
    const previousTotalScore = p.score || 0;       
    return { ...p, score: previousTotalScore + currentRoundScoreValue };
  });

  newState.players.forEach(player => {
    if (player.roundScore > maxRoundScore) {
      maxRoundScore = player.roundScore;
      currentRoundWinners = [player];
    } else if (player.roundScore === maxRoundScore && maxRoundScore > 0) {
      currentRoundWinners.push(player);
    }
  });

  if (currentRoundWinners.length > 0 && maxRoundScore > 0) {
    if (currentRoundWinners.length === 1) {
      const winner = currentRoundWinners[0];
      newState = addLogEntry(newState, `${winner.name} had the most plants this round with ${maxRoundScore}!`);
      newState.roundWinner = winner;
    } else {
      const winnerNames = currentRoundWinners.map(w => w.name).join(' and ');
      newState = addLogEntry(newState, `Tie for most plants this round! ${winnerNames} each had ${maxRoundScore}.`);
      newState.roundWinner = currentRoundWinners[0]; 
    }
  } else {
    newState = addLogEntry(newState, "Round ended. No player scored any plant points this round.");
    newState.roundWinner = null;
  }
  return newState;
};


export const checkForRoundEnd = (gameState: GameState): boolean => {
  for (const player of gameState.players) {
    const allPotsAreWeedPlants = player.pots.every(pot => pot.card && pot.card.type === CardType.PLANT);
    const filledPotsCount = player.pots.filter(pot => pot.card !== null).length;
    if (filledPotsCount === NUM_POTS && allPotsAreWeedPlants) {
      return true;
    }
  }

  if (gameState.drawPile.length === 0) {
    const totalCardsInHands = gameState.players.reduce((sum, player) => sum + player.hand.length, 0);
    if (totalCardsInHands === 0) {
      return true;
    }
  }
  return false;
};

export const checkForGameEnd = (gameState: GameState): Player | null => {
  let gameWinner: Player | null = null;
  let maxTotalScore = -1;

  const potentialWinners = gameState.players.filter(p => p.score >= WINNING_SCORE);

  if (potentialWinners.length === 0) {
    return null; 
  }

  for (const player of potentialWinners) {
    if (player.score > maxTotalScore) {
      maxTotalScore = player.score;
      gameWinner = player;
    }
  }
  
  const tiedWinners = potentialWinners.filter(p => p.score === maxTotalScore);
  if (tiedWinners.length > 1) {
    gameWinner = tiedWinners[0]; 
  }

  return gameWinner; 
};


export const startNewRound = (gameState: GameState): GameState => {
  let newDeck = shuffleDeck([...INITIAL_DECK.map(card => ({...card, id: uuidv4()}))]); 
  
  let oldDiscardPile: GameCard[] = [...gameState.discardPile]; 

  const players = gameState.players.map(p_orig => {
    const p = {...p_orig}; 
    p.pots.forEach(pot => {
      if (pot.card) oldDiscardPile.push(pot.card);
    });
    p.hand.forEach(card => oldDiscardPile.push(card));

    const newPlayer = createInitialPlayer(p.id, p.name); 
    newPlayer.score = p.score; 
    newPlayer.isSkipped = false; 
    newPlayer.roundScore = 0; 
    return newPlayer;
  });

  players.forEach(player => {
    for (let i = 0; i < STARTING_HAND_SIZE; i++) {
      if (newDeck.length > 0) {
        player.hand.push(newDeck.pop()!);
      }
    }
  });

  let nextRoundStarterIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length; 
  const roundWinnerObj = gameState.roundWinner;
  if(roundWinnerObj){
      const winnerIdx = players.findIndex(p => p.id === roundWinnerObj.id);
      if(winnerIdx !== -1) nextRoundStarterIndex = winnerIdx;
  }


  return {
    ...gameState, 
    players,
    drawPile: newDeck,
    discardPile: [], 
    currentPlayerIndex: nextRoundStarterIndex, 
    gamePhase: GamePhase.PLAYING,
    roundWinner: null,
    gameLog: [...(gameState.gameLog || []), "New round started!"].slice(-20),
    message: `${players[nextRoundStarterIndex].name}'s turn. Select a card or action.`,
    targetSelection: null,
    turnActionDone: false,
  };
};


export const advanceTurn = (gameState: GameState): GameState => {
  let newState = { ...gameState };
  let nextPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  
  const modifiablePlayers = newState.players.map(p => ({...p})); 

  while (modifiablePlayers[nextPlayerIndex].isSkipped) {
    modifiablePlayers[nextPlayerIndex].isSkipped = false; 
    newState = addLogEntry(newState, `${modifiablePlayers[nextPlayerIndex].name}'s turn was skipped.`);
    nextPlayerIndex = (nextPlayerIndex + 1) % modifiablePlayers.length;
  }
  
  newState.players = modifiablePlayers; 
  newState.currentPlayerIndex = nextPlayerIndex;
  newState.message = `${newState.players[newState.currentPlayerIndex].name}'s turn. Select a card or action.`;
  newState.turnActionDone = false; 
  newState.targetSelection = null; 
  newState.gamePhase = GamePhase.PLAYING; 
  
  return newState;
};
