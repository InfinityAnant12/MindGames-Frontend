

import React from 'react';
import { Player, Pot, GameCard, GamePhase, TargetSelection, CardType, PowerCard, PowerCardName } from '../types';
import CardView from './CardView';
import PotView from './PotView';

interface PlayerDisplayProps {
  player: Player;
  isCurrentPlayer: boolean;
  isSelf: boolean; 
  onCardClickInHand: (card: GameCard, player: Player) => void; 
  onPotClick?: (player: Player, potIndex: number) => void; 
  onPlayerClick?: (player: Player) => void; 
  targetingInfo?: TargetSelection | null;
  gamePhase: GamePhase;
  turnActionDone: boolean;
  isDiscardModeActive: boolean; // New prop
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({
  player,
  isCurrentPlayer,
  isSelf,
  onCardClickInHand,
  onPotClick,
  onPlayerClick,
  targetingInfo,
  gamePhase,
  turnActionDone,
  isDiscardModeActive, 
}) => {
  const isTargetingPlayerForEffect = gamePhase === GamePhase.TARGETING_PLAYER && targetingInfo?.targetType === 'player';
  const canTargetThisPlayerForPlayerLevelEffect = isTargetingPlayerForEffect && player.id !== targetingInfo?.sourcePlayerId;
  
  if (isTargetingPlayerForEffect) {
    console.log(`[PlayerDisplay Debug] Player: ${player.name}, isSelf: ${isSelf}`);
    console.log(`  GamePhase: ${gamePhase}, TargetingType: ${targetingInfo?.targetType}`);
    console.log(`  targetingInfo.sourcePlayerId: ${targetingInfo?.sourcePlayerId}, player.id: ${player.id}`);
    console.log(`  isTargetingPlayerForEffect: ${isTargetingPlayerForEffect}`);
    console.log(`  canTargetThisPlayerForPlayerLevelEffect (should be true for opponents): ${canTargetThisPlayerForPlayerLevelEffect}`);
    console.log(`  onPlayerClick defined: ${!!onPlayerClick}`);
  }

  const playerBoardClasses = `p-2 sm:p-2 md:p-3 rounded-lg shadow-xl relative player-board
    ${isCurrentPlayer ? 'border-4 border-emerald-400 bg-green-50' : 'bg-stone-100 border-2 border-stone-300'}
    ${canTargetThisPlayerForPlayerLevelEffect && onPlayerClick ? 'targetable ring-2 ring-amber-500 cursor-pointer' : ''}`;

  return (
    <div 
      className={playerBoardClasses}
      onClick={
        canTargetThisPlayerForPlayerLevelEffect && onPlayerClick 
          ? () => {
              console.log(`[PlayerDisplay Debug] Clicked on targetable player: ${player.name}`);
              onPlayerClick(player);
            }
          : undefined
      }
    >
      <h3 className={`text-sm sm:text-md md:text-lg font-semibold mb-1 ${isCurrentPlayer ? 'text-emerald-700' : 'text-stone-700'}`}>
        {player.name} {isSelf ? '(You)' : ''} {player.isSkipped ? <span className="text-red-500 text-xs md:text-sm">(Skipped)</span> : ''}
      </h3>
      <p className="text-xs text-stone-500 mb-0.5">Total: {player.score}</p>
      <p className="text-xs text-stone-500 mb-1">Round: {player.roundScore}</p>

      {/* Pots */}
      <div className="flex space-x-1 sm:space-x-1.5 mb-2 justify-center">
        {player.pots.map((pot, index) => {
          let potIsTargetable = false;
          if (targetingInfo && onPotClick) {
            const cardBeingPlayed = targetingInfo.cardPlayed;
            const isPotOwnerSourcePlayer = player.id === targetingInfo.sourcePlayerId;

            if (cardBeingPlayed?.type === CardType.PLANT &&
                targetingInfo.targetType === 'any_empty_pot' && 
                gamePhase === GamePhase.TARGETING_PLAYER_POT &&  
                targetingInfo.allowedPotContent === 'empty' &&
                !pot.card) {
                potIsTargetable = true;
            }
            else if (cardBeingPlayed?.type === CardType.POWER && (cardBeingPlayed as PowerCard).name === PowerCardName.DANDELION &&
                targetingInfo.targetType === 'opponent_pot_empty' &&
                gamePhase === GamePhase.TARGETING_PLAYER_POT && 
                targetingInfo.allowedPotContent === 'empty' &&
                !isPotOwnerSourcePlayer && 
                !pot.card) { 
                potIsTargetable = true;
            }
            else if (cardBeingPlayed?.type === CardType.POWER && (cardBeingPlayed as PowerCard).name === PowerCardName.STEAL &&
                targetingInfo.targetType === 'player_pot' && 
                gamePhase === GamePhase.TARGETING_PLAYER_POT && 
                targetingInfo.allowedPotContent === 'plant' &&
                !isPotOwnerSourcePlayer && 
                pot.card?.type === CardType.PLANT) { 
                potIsTargetable = true;
            }
            else if (gamePhase === GamePhase.TARGETING_SELF_POT && isPotOwnerSourcePlayer) {
                if (targetingInfo.allowedPotContent === 'empty' && !pot.card && cardBeingPlayed?.type === CardType.POWER && (cardBeingPlayed as PowerCard).name === PowerCardName.STEAL && targetingInfo.targetType === 'self_pot_empty') {
                    potIsTargetable = true;
                } else if (targetingInfo.allowedPotContent === 'plant' && pot.card?.type === CardType.PLANT && cardBeingPlayed?.type === CardType.POWER && (cardBeingPlayed as PowerCard).name === PowerCardName.COMPOST && targetingInfo.targetType === 'self_pot_plant') {
                    potIsTargetable = true;
                } else if (targetingInfo.allowedPotContent === 'dandelion' && pot.card?.type === CardType.POWER && (pot.card as PowerCard).name === PowerCardName.DANDELION && cardBeingPlayed?.type === CardType.POWER && (cardBeingPlayed as PowerCard).name === PowerCardName.WEED_KILLER && targetingInfo.targetType === 'self_pot_dandelion') {
                    potIsTargetable = true;
                }
            }
          }
          
          return (
            <PotView
              key={pot.id}
              pot={pot}
              onClick={potIsTargetable && onPotClick ? () => onPotClick(player, index) : undefined}
              isTargetable={potIsTargetable}
            />
          );
        })}
      </div>

      {/* Hand */}
      {isSelf ? (
        <>
          <h4 className="text-xs sm:text-sm font-semibold mt-2 mb-1 text-stone-600">
            Your Hand ({player.hand.length}):
            {isDiscardModeActive && isCurrentPlayer && <span className="text-red-500 ml-2">(Discard Mode: Click card to discard)</span>}
          </h4>
          <div className="flex space-x-1 sm:space-x-1.5 flex-wrap justify-center min-h-[8rem] sm:min-h-[10rem] bg-stone-200 p-1 rounded">
            {player.hand.length > 0 ? player.hand.map(cardInHand => {
              const cardIsSelectedForTargeting = targetingInfo && targetingInfo.cardPlayed.id === cardInHand.id;
              
              let canInteractWithCard = false;
              if (isCurrentPlayer && !turnActionDone) {
                if (isDiscardModeActive) {
                  canInteractWithCard = true; // Any card can be discarded
                } else if (!targetingInfo || cardIsSelectedForTargeting) {
                  canInteractWithCard = true; // Can initiate play or cancel targeting
                }
              } else if (isCurrentPlayer && targetingInfo && cardIsSelectedForTargeting) {
                 canInteractWithCard = true; // Can cancel targeting even if turnActionDone
              }


              return (
                <CardView
                  key={cardInHand.id}
                  card={cardInHand}
                  onClick={canInteractWithCard ? () => onCardClickInHand(cardInHand, player) : undefined}
                  isPlayable={canInteractWithCard} // General "interactable" flag
                  className={`mb-1 sm:mb-1.5 w-24 h-36 sm:w-28 sm:h-40 md:w-32 md:h-48 
                              ${cardIsSelectedForTargeting ? 'ring-2 sm:ring-4 ring-blue-500 ring-offset-1' : ''}
                              ${isDiscardModeActive && isCurrentPlayer && !turnActionDone ? 'hover:ring-2 hover:ring-red-500' : ''}
                            `}
                />
              );
            }) : <p className="text-stone-500 text-xs sm:text-sm p-2">No cards in hand.</p>}
          </div>
        </>
      ) : (
         <div className="text-xs text-stone-500 mt-2">Hand: {player.hand.length} card{player.hand.length !== 1 ? 's' : ''}</div>
      )}
    </div>
  );
};

export default PlayerDisplay;
