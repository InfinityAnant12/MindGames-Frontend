

import { GameState, Player, GameCard, CardType, PowerCardName, PlantCard, PowerCard, Pot } from '../types';

export type AIAction =
  | { type: 'PLAY_PLANT'; cardId: string; potIndex: number; targetPlayerIdForPot: string; }
  | { type: 'PLAY_DANDELION'; cardId: string; potIndex: number; targetPlayerIdForPot: string; }
  | { type: 'PLAY_WEED_KILLER'; cardId: string; potIndex: number } 
  | { type: 'PLAY_COMPOST'; cardId: string; potIndex: number }    
  | { type: 'PLAY_STEAL'; cardId: string; targetPlayerId: string; targetPotIndex: number; selfPotIndex: number }
  | { type: 'PLAY_HIPPIE_POWER'; cardId: string; targetPlayerId: string }
  | { type: 'PLAY_BUSTED'; cardId: string; targetPlayerId: string }
  | { type: 'PLAY_POTZILLA'; cardId: string; targetPlayerId: string }
  | { type: 'DISCARD_CARD'; cardId: string }
  | { type: 'END_TURN' };

const getPlayerTotalPlantValue = (player: Player): number => {
    return player.pots.reduce((sum, pot) => {
        if (pot.card && pot.card.type === CardType.PLANT) {
            return sum + (pot.card as PlantCard).plants;
        }
        return sum;
    }, 0);
};


export const makeAIMove = (gameState: GameState, aiPlayer: Player, allPlayers: Player[]): AIAction | null => {
  if (aiPlayer.isSkipped) return { type: 'END_TURN'}; // Should not happen if advanceTurn handles skips

  const hand = [...aiPlayer.hand]; // Operate on a copy for sorting/finding
  const myPots = aiPlayer.pots;
  const opponents = allPlayers.filter(p => p.id !== aiPlayer.id);

  // 1. Play Weed Killer (self-use)
  const weedKillerCard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.WEED_KILLER) as PowerCard | undefined;
  if (weedKillerCard) {
    const dandelionPotIndex = myPots.findIndex(p => p.card && p.card.type === CardType.POWER && (p.card as PowerCard).name === PowerCardName.DANDELION);
    if (dandelionPotIndex !== -1) {
      return { type: 'PLAY_WEED_KILLER', cardId: weedKillerCard.id, potIndex: dandelionPotIndex };
    }
  }

  // 2. Play Compost (self-use)
  const compostCard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.COMPOST) as PowerCard | undefined;
  if (compostCard) {
    let bestPlantPotIndex = -1;
    let maxPlants = -1;
    myPots.forEach((pot, index) => {
      if (pot.card && pot.card.type === CardType.PLANT) {
        if ((pot.card as PlantCard).plants > maxPlants) {
          maxPlants = (pot.card as PlantCard).plants;
          bestPlantPotIndex = index;
        }
      }
    });
    if (bestPlantPotIndex !== -1) {
      return { type: 'PLAY_COMPOST', cardId: compostCard.id, potIndex: bestPlantPotIndex };
    }
  }

  // 3. Play Plant Card
  const plantCardsInHand = hand.filter(c => c.type === CardType.PLANT) as PlantCard[];
  plantCardsInHand.sort((a, b) => b.originalPlants - a.originalPlants); 

  if (plantCardsInHand.length > 0) {
    const myEmptyPotIndex = myPots.findIndex(p => !p.card);
    if (myEmptyPotIndex !== -1) {
      return { type: 'PLAY_PLANT', cardId: plantCardsInHand[0].id, potIndex: myEmptyPotIndex, targetPlayerIdForPot: aiPlayer.id };
    }
    if (opponents.length > 0) {
        for (const opponent of opponents) { 
            const opponentEmptyPotIndex = opponent.pots.findIndex(p => !p.card);
            if (opponentEmptyPotIndex !== -1) {
                const plantToPlayOnOpponent = plantCardsInHand[plantCardsInHand.length -1]; 
                return { type: 'PLAY_PLANT', cardId: plantToPlayOnOpponent.id, potIndex: opponentEmptyPotIndex, targetPlayerIdForPot: opponent.id };
            }
        }
    }
  }
  
  // 4. Play Dandelion (only on opponent's empty pot)
  const dandelionCard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.DANDELION) as PowerCard | undefined;
  if (dandelionCard && opponents.length > 0) {
    for (const opponent of opponents) {
        const opponentEmptyPotIndex = opponent.pots.findIndex(p => !p.card);
        if (opponentEmptyPotIndex !== -1) {
            return { type: 'PLAY_DANDELION', cardId: dandelionCard.id, potIndex: opponentEmptyPotIndex, targetPlayerIdForPot: opponent.id };
        }
    }
  }

  // 5. Play Offensive Power Cards
  const potzillaCard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.POTZILLA) as PowerCard | undefined;
  if (potzillaCard && opponents.length > 0) {
    let targetPlayerForPotzilla: Player | null = null;
    let maxOpponentPlantValue = -1;
    opponents.forEach(opp => {
        const oppValue = getPlayerTotalPlantValue(opp); 
        if (oppValue > 0 && oppValue > maxOpponentPlantValue) { 
            maxOpponentPlantValue = oppValue;
            targetPlayerForPotzilla = opp;
        }
    });
    if (!targetPlayerForPotzilla && opponents.length > 0) { 
        targetPlayerForPotzilla = opponents[Math.floor(Math.random() * opponents.length)];
    }
    if (targetPlayerForPotzilla) { 
        return { type: 'PLAY_POTZILLA', cardId: potzillaCard.id, targetPlayerId: targetPlayerForPotzilla.id };
    }
  }

  const bustedCard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.BUSTED) as PowerCard | undefined;
  if (bustedCard && opponents.length > 0) {
    let targetPlayerIdForBusted: string | null = null;
    let maxPlantValueInPot = -1;
    opponents.forEach(opp => { 
      opp.pots.forEach(pot => {
        if (pot.card && pot.card.type === CardType.PLANT) {
          if ((pot.card as PlantCard).plants > maxPlantValueInPot) {
            maxPlantValueInPot = (pot.card as PlantCard).plants;
            targetPlayerIdForBusted = opp.id;
          }
        }
      });
    });
    if (targetPlayerIdForBusted) {
      return { type: 'PLAY_BUSTED', cardId: bustedCard.id, targetPlayerId: targetPlayerIdForBusted };
    } else if (opponents.length > 0) { 
        const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
        return { type: 'PLAY_BUSTED', cardId: bustedCard.id, targetPlayerId: randomOpponent.id };
    }
  }

  const hippiePowerCard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.HIPPIE_POWER) as PowerCard | undefined;
  if (hippiePowerCard && opponents.length > 0) {
    let targetPlayerIdForHippie: string | null = null;
    let minPlantValueInPot = Infinity;
     opponents.forEach(opp => { 
      opp.pots.forEach(pot => {
        if (pot.card && pot.card.type === CardType.PLANT) {
          if ((pot.card as PlantCard).plants < minPlantValueInPot) {
            minPlantValueInPot = (pot.card as PlantCard).plants;
            targetPlayerIdForHippie = opp.id;
          }
        }
      });
    });
     if (targetPlayerIdForHippie) {
      return { type: 'PLAY_HIPPIE_POWER', cardId: hippiePowerCard.id, targetPlayerId: targetPlayerIdForHippie };
    } else if (opponents.length > 0) { 
        const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
        return { type: 'PLAY_HIPPIE_POWER', cardId: hippiePowerCard.id, targetPlayerId: randomOpponent.id };
    }
  }
  
  const stealCard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.STEAL) as PowerCard | undefined;
  if (stealCard) {
    const selfEmptyPotIndex = myPots.findIndex(p => !p.card);
    if (selfEmptyPotIndex !== -1) { 
      let bestTargetPlayerId: string | null = null;
      let bestTargetPotIndex = -1;
      let maxStolenPlantValue = -1;

      opponents.forEach(opp => {
        opp.pots.forEach((pot, index) => {
          if (pot.card && pot.card.type === CardType.PLANT) { 
            if ((pot.card as PlantCard).plants > maxStolenPlantValue) {
              maxStolenPlantValue = (pot.card as PlantCard).plants;
              bestTargetPlayerId = opp.id;
              bestTargetPotIndex = index;
            }
          }
        });
      });

      if (bestTargetPlayerId && bestTargetPotIndex !== -1) {
        return { type: 'PLAY_STEAL', cardId: stealCard.id, targetPlayerId: bestTargetPlayerId, targetPotIndex: bestTargetPotIndex, selfPotIndex: selfEmptyPotIndex };
      }
    }
  }

  // 6. Discard Card (if no better plays)
  if (hand.length > 0) {
    // Attempt to discard the "least valuable" card
    let cardToDiscard: GameCard | undefined = undefined;
    
    // Priority 1: Dandelion
    cardToDiscard = hand.find(c => c.type === CardType.POWER && (c as PowerCard).name === PowerCardName.DANDELION);
    
    // Priority 2: Lowest value plant card
    if (!cardToDiscard) {
      const plantsInHand = hand.filter(c => c.type === CardType.PLANT) as PlantCard[];
      if (plantsInHand.length > 0) {
        plantsInHand.sort((a,b) => a.originalPlants - b.originalPlants); // Sort weakest to strongest
        cardToDiscard = plantsInHand[0];
      }
    }

    // Priority 3: Any other remaining card (e.g. power card with no good target)
    if (!cardToDiscard) {
      cardToDiscard = hand[0]; // Just discard the first card if nothing specific fits
    }
    
    if (cardToDiscard) {
      return { type: 'DISCARD_CARD', cardId: cardToDiscard.id };
    }
  }

  // 7. End Turn (if no other action was possible, or hand is empty)
  return { type: 'END_TURN' };
};
