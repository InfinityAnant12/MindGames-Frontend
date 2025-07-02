
import React from 'react';
import { GameState, Player, GameCard, CardType, PlantCard, PowerCard, PowerCardName, GamePhase, TargetSelection } from '../types';
import PlayerDisplay from './PlayerDisplay';
import CardView from './CardView';
import ActionButton from './ActionButton';
import GameLog from './GameLog';

interface GameBoardProps {
  gameState: GameState;
  onCardClickInHand: (card: GameCard, player: Player) => void;
  onToggleDiscardMode: () => void;
  isDiscardModeActive: boolean;
  canPlayerDiscard: boolean; // Controls if discard button is enabled
  onPlayerTargetSelect: (player: Player) => void;
  onPlayerPotTargetSelect: (player: Player, potIndex: number) => void;
  onSelfPotTargetSelect: (player: Player, potIndex: number) => void;
  userId: string; // ID of the human player
  isMobile: boolean;
  onToggleRulesModal: () => void; // New prop
}

const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  onCardClickInHand,
  onToggleDiscardMode,
  isDiscardModeActive,
  canPlayerDiscard,
  onPlayerTargetSelect,
  onPlayerPotTargetSelect,
  onSelfPotTargetSelect,
  userId,
  isMobile,
  onToggleRulesModal, // New prop
}) => {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer.id === userId;
  const gamePhase = gameState.gamePhase;

  const getTargetingMessage = () => {
    if (!gameState.targetSelection) return "";
    let message = gameState.targetSelection.message;
    if (gameState.targetSelection.cardPlayed) {
        const cardName = gameState.targetSelection.cardPlayed.type === CardType.PLANT ? 
            `${(gameState.targetSelection.cardPlayed as PlantCard).originalPlants}-plant` : 
            (gameState.targetSelection.cardPlayed as PowerCard).name;
      message = `Playing ${cardName}. ${message}`;
    }
    return message;
  }

  const humanPlayer = gameState.players.find(p => p.id === userId);
  const opponentPlayer = (isMobile && gameState.players.length === 2) ? gameState.players.find(p => p.id !== userId) : null;


  return (
    <div className={`p-2 sm:p-4 md:p-6 min-h-screen bg-black text-gray-100 ${isMobile && gameState.players.length === 2 ? 'pt-28 sm:pt-32' : ''}`}>
      {/* Game Rules Button - Fixed Top Left */}
      <div className="fixed top-2 left-2 z-30">
        <ActionButton 
          onClick={onToggleRulesModal} 
          variant="secondary" 
          className="text-xs py-1 px-2 sm:text-sm sm:py-1.5 sm:px-3"
        >
          Game Rules
        </ActionButton>
      </div>
      
      <header className="mb-4 text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-emerald-400">Weed Game v2</h1>
        {gameState.message && <p className="text-sm sm:text-md md:text-lg text-emerald-300 mt-1">{gameState.message}</p>}
        {gameState.targetSelection && <p className="text-sm sm:text-md md:text-lg text-amber-400 font-semibold mt-1 animate-pulse">{getTargetingMessage()}</p>}
      </header>

      {/* Draw/Discard Piles & Actions - Fixed Corner Display */}
      <div className={`fixed top-2 right-2 p-1 sm:p-2 md:p-3 bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-xl z-20 flex flex-col space-y-1 sm:space-y-2 items-center max-w-[100px] sm:max-w-[120px] md:max-w-[150px]`}>
        {/* Draw Pile Count */}
        <div className="text-center w-full">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-300 mb-0.5">Draw Pile</h3>
          <CardView 
            card={{id: 'drawpile_count_display', type: CardType.POWER, name: 'Pile' as PowerCardName, description: `${gameState.drawPile.length} cards remaining`}} 
            className="opacity-80 mx-auto w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-32"
          />
          <p className="text-center mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-400">{gameState.drawPile.length} card{gameState.drawPile.length !== 1 ? 's' : ''}</p>
        </div>
        
        {/* Discard Pile */}
        <div className="text-center w-full">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-300 mb-0.5">Discard Pile</h3>
          <CardView 
            card={gameState.discardPile.length > 0 ? gameState.discardPile[gameState.discardPile.length - 1] : null} 
            className="opacity-80 mx-auto w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-32"
          />
          <p className="text-center mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-400">{gameState.discardPile.length} card{gameState.discardPile.length !== 1 ? 's' : ''}</p>
        </div>
        
        {/* Discard Action Button */}
        {isMyTurn && !currentPlayer.isSkipped && !gameState.targetSelection && !gameState.turnActionDone && (
          <ActionButton
            onClick={onToggleDiscardMode}
            className="w-full text-[9px] sm:text-[10px] md:text-xs py-1"
            variant={isDiscardModeActive ? 'danger' : 'secondary'}
            disabled={!canPlayerDiscard && !isDiscardModeActive} // Disable if cannot enter discard mode, but allow cancel
          >
            {isDiscardModeActive ? 'Cancel Discard' : 'Discard Card'}
          </ActionButton>
        )}
      </div>

      {/* Player Boards */}
      <div className={`mt-4 ${isMobile && gameState.players.length === 2 ? 'flex flex-col space-y-3 sm:space-y-4' : 'flex flex-wrap justify-center items-start gap-2 sm:gap-3 md:gap-4'}`}>
        {isMobile && gameState.players.length === 2 && opponentPlayer && humanPlayer ? (
          <>
            {/* Opponent (AI) at the top */}
            <div className="w-full order-first">
              <PlayerDisplay
                key={opponentPlayer.id}
                player={opponentPlayer}
                isCurrentPlayer={opponentPlayer.id === currentPlayer.id}
                isSelf={false}
                onCardClickInHand={onCardClickInHand} // AI doesn't click, but prop is needed
                onPotClick={(p, potIdx) => {
                    if (!gameState.targetSelection) return;
                    const targetInfo = gameState.targetSelection;
                    if (p.id !== targetInfo.sourcePlayerId && (targetInfo.targetType === 'player_pot' || targetInfo.targetType === 'opponent_pot_empty' || targetInfo.targetType === 'any_empty_pot')) {
                        onPlayerPotTargetSelect(p, potIdx);
                    }
                }}
                onPlayerClick={onPlayerTargetSelect}
                targetingInfo={gameState.targetSelection}
                gamePhase={gameState.gamePhase}
                turnActionDone={gameState.turnActionDone}
                isDiscardModeActive={false} // AI doesn't use UI discard mode
              />
            </div>

            {/* Human Player at the bottom */}
            <div className="w-full order-last">
              <PlayerDisplay
                key={humanPlayer.id}
                player={humanPlayer}
                isCurrentPlayer={humanPlayer.id === currentPlayer.id}
                isSelf={true}
                onCardClickInHand={onCardClickInHand}
                onPotClick={(p, potIdx) => {
                  if (!gameState.targetSelection) return;
                  const targetInfo = gameState.targetSelection;
                  if (p.id === targetInfo.sourcePlayerId && targetInfo.targetType.startsWith('self_pot')) {
                    onSelfPotTargetSelect(p, potIdx);
                  } else if (targetInfo.targetType === 'any_empty_pot' && gamePhase === GamePhase.TARGETING_PLAYER_POT) {
                     onPlayerPotTargetSelect(p, potIdx); 
                  }
                }}
                targetingInfo={gameState.targetSelection}
                gamePhase={gameState.gamePhase}
                turnActionDone={gameState.turnActionDone}
                isDiscardModeActive={isDiscardModeActive && humanPlayer.id === currentPlayer.id}
              />
            </div>
          </>
        ) : (
          // Original layout for desktop or >2 players or non-2-player mobile
          gameState.players.map(player => (
            <PlayerDisplay
              key={player.id}
              player={player}
              isCurrentPlayer={player.id === currentPlayer.id}
              isSelf={player.id === userId}
              onCardClickInHand={onCardClickInHand}
              onPotClick={(p, potIdx) => {
                if (!gameState.targetSelection) return;
                const targetInfo = gameState.targetSelection;
                if (p.id === targetInfo.sourcePlayerId && targetInfo.targetType.startsWith('self_pot')) {
                   onSelfPotTargetSelect(p, potIdx);
                } 
                else if (p.id !== targetInfo.sourcePlayerId && 
                         (targetInfo.targetType === 'player_pot' || targetInfo.targetType === 'opponent_pot_empty')
                ) {
                   onPlayerPotTargetSelect(p, potIdx);
                }
                else if (targetInfo.targetType === 'any_empty_pot' && gamePhase === GamePhase.TARGETING_PLAYER_POT) {
                  onPlayerPotTargetSelect(p, potIdx);
                }
              }}
              onPlayerClick={onPlayerTargetSelect}
              targetingInfo={gameState.targetSelection}
              gamePhase={gameState.gamePhase}
              turnActionDone={gameState.turnActionDone}
              isDiscardModeActive={isDiscardModeActive && player.id === userId && player.id === currentPlayer.id}
            />
          ))
        )}
      </div>
      
      <GameLog logs={gameState.gameLog} />
    </div>
  );
};

export default GameBoard;
