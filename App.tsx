
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Player, GameCard, CardType, PowerCardName, PlantCard, PowerCard, TargetSelection, Pot, PlayerActionPayload, ClientToServerEvents, ServerToClientEvents } from './types';
import { WINNING_SCORE, MAX_PLAYERS as MAX_SINGLE_PLAYERS } from './constants'; // Renamed for clarity
import GameSetup from './components/GameSetup';
import GameBoard from './components/GameBoard';
import Modal from './components/Modal';
import GameModeSelection from './components/GameModeSelection';
import MultiplayerLobby from './components/MultiplayerLobby';
import Confetti from './components/Confetti';
import * as gameService from './services/gameService';
import * as aiService from './services/aiService'; 
import { io, Socket } from 'socket.io-client';

type GameMode = 'single' | 'multiplayer' | null;
type LobbyScreen = 'initial' | 'hosting' | 'joining' | 'waiting_for_host' | 'waiting_for_players' | 'in_game_lobby';


const AI_THINK_DELAY = 1500; 
const SERVER_URL = 'https://mindgames-backend.onrender.com'; // Backend server URL

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState<string>(''); // For single player, it's player[0].id. For multiplayer, it's socket.id
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>(null);
  const isProcessingAiTurnRef = useRef(false);
  const aiActionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isDiscardModeActive, setIsDiscardModeActive] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // State for link-based multiplayer lobby
  const [lobbyScreen, setLobbyScreen] = useState<LobbyScreen>('initial');
  const [hostedGameLink, setHostedGameLink] = useState<string | null>(null);
  const [joinLinkInput, setJoinLinkInput] = useState<string>('');
  const [lobbyMessage, setLobbyMessage] = useState<string>('');
  const [playerNameInput, setPlayerNameInput] = useState<string>('Player');

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);


  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    };
  }, []);


  const initGame = useCallback((numPlayers: number, humanPlayerName: string) => {
    // Single player initialization
    const initialState = gameService.initializeGame(numPlayers, humanPlayerName);
    setGameState(initialState);
    if (initialState.players.length > 0) {
      setUserId(initialState.players[0].id); 
    }
    isProcessingAiTurnRef.current = false;
    setIsDiscardModeActive(false);
  }, []);

  const connectSocket = () => {
    if (socketRef.current) return;

    const newSocket = io(SERVER_URL);
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected to socket server with ID:', newSocket.id);
      // setUserId(newSocket.id); // Server will confirm player ID on join/host
    });
    
    newSocket.on('player-joined-room', ({ newPlayer, roomSize, gameState: updatedGameState }) => {
        setLobbyMessage(`${newPlayer.name} joined! Players in room: ${roomSize}.`);
        setGameState(updatedGameState); // Update with latest state
        // If I am the host and more players can join, keep waiting
        // If room is full or host decides to start, transition phase
    });

    newSocket.on('game-started', (initialGameState) => {
        setLobbyMessage('Game is starting!');
        setGameState(initialGameState);
        setSelectedGameMode('multiplayer'); // Ensure mode is set
        setLobbyScreen('in_game_lobby'); // Or directly to playing if gamePhase dictates
    });
    
    newSocket.on('game-state-update', (updatedGameState) => {
        console.log('Received game state update from server');
        setGameState(updatedGameState);
    });

    newSocket.on('error-message', ({ message }) => {
        setLobbyMessage(`Error: ${message}`);
        // Potentially reset lobby screen if error is critical
        if (message.includes("not found") || message.includes("full")) {
            setLobbyScreen('initial');
            setHostedGameLink(null);
        }
    });

    newSocket.on('game-not-found', () => {
        setLobbyMessage('Error: Game not found. Please check the link or host a new game.');
        setLobbyScreen('initial');
    });

    newSocket.on('room-full', () => {
        setLobbyMessage('Error: This game room is full.');
        setLobbyScreen('initial');
    });

    newSocket.on('disconnect', () => {
        console.log('Disconnected from socket server');
        // setLobbyMessage('Disconnected. Please try again.');
        // setSelectedGameMode(null); // Or try to reconnect
    });
  };


  const handleModeSelect = (mode: 'single' | 'multiplayer') => {
    setSelectedGameMode(mode);
    setGameState(null); 
    setIsDiscardModeActive(false);
    setLobbyMessage('');
    setPlayerNameInput(`Player${Math.floor(Math.random() * 1000)}`); // Default player name

    if (mode === 'single') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setLobbyScreen('initial'); 
    } else if (mode === 'multiplayer') {
      connectSocket();
      setLobbyScreen('initial');
      setHostedGameLink(null);
      setJoinLinkInput('');
    }
  };

  const handleBackToModeSelection = () => {
    if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
    }
    setSelectedGameMode(null);
    setGameState(null);
    setIsDiscardModeActive(false);
    setLobbyScreen('initial'); 
    setHostedGameLink(null);
    setUserId('');
  };
  
  const handleToggleDiscardMode = () => {
    if (gameState?.targetSelection) return; 
    setIsDiscardModeActive(prev => !prev);
  };

  const handleToggleRulesModal = () => {
    setShowRulesModal(prev => !prev);
  };

  const handleHostGame = () => {
    if (!socketRef.current || !socketRef.current.connected) {
        setLobbyMessage('Not connected to server. Please try again.');
        connectSocket(); // Try to reconnect
        return;
    }
    if (!playerNameInput.trim()) {
        setLobbyMessage('Please enter your player name.');
        return;
    }

    setLobbyMessage('Creating game, please wait...');
    let hostingTimedOut = false;
    const timeoutId = setTimeout(() => {
        hostingTimedOut = true;
        setLobbyMessage('Error: Server did not respond in time. It might be busy or offline. Please try again.');
    }, 10000); // 10 second timeout

    socketRef.current.emit('host-game', playerNameInput.trim(), (response) => {
      clearTimeout(timeoutId);
      if (hostingTimedOut) {
        console.log("Received a late response from server after timeout. Ignoring.");
        return;
      }
      
      console.log('Host game response from server:', response);
      if (response && response.gameId && response.playerId && response.initialGameState) {
          const { gameId, playerId, initialGameState } = response;
          setHostedGameLink(`${window.location.origin}${window.location.pathname}#join?gameId=${gameId}`);
          setGameState({ ...initialGameState, gameId });
          setUserId(playerId);
          setLobbyScreen('hosting');
          setLobbyMessage('Share this link with your friends. Waiting for players to join...');
      } else {
          setLobbyMessage('Error: Could not create game. The server returned an invalid or empty response.');
          console.error('Invalid response from server on host-game:', response);
      }
    });
  };

  const navigateToJoinScreen = () => {
    if (!playerNameInput.trim()) {
        setLobbyMessage('Please enter your player name before joining.');
        setLobbyScreen('initial'); // Go back to where they can enter name
        return;
    }
    setLobbyScreen('joining');
    setLobbyMessage('Enter the game link provided by the host.');
    setJoinLinkInput(''); 
  };

  const handleJoinGameAttempt = () => {
    if (!socketRef.current) {
        setLobbyMessage('Not connected to server. Please try again.');
        connectSocket();
        return;
    }
    if (!playerNameInput.trim()) {
        setLobbyMessage('Please enter your player name.');
        return;
    }
    if (!joinLinkInput.trim()) {
      setLobbyMessage('Please enter a game link to join.');
      return;
    }
    
    let gameIdToJoin = '';
    try {
      const url = new URL(joinLinkInput); // Use the input field value
      if (url.hash.startsWith('#join?gameId=')) {
        gameIdToJoin = url.hash.substring('#join?gameId='.length);
      } else {
         gameIdToJoin = url.searchParams.get('gameId') || ''; // Fallback for query param, though hash is preferred
      }
    } catch (error) {
      // If not a full URL, assume it's just the gameId
      gameIdToJoin = joinLinkInput.trim();
    }


    if (gameIdToJoin) {
      setLobbyMessage(`Attempting to join game: ${gameIdToJoin}...`);
      socketRef.current.emit('join-game', { gameId: gameIdToJoin, playerName: playerNameInput.trim() }, (response) => {
        if (response.success && response.gameState && response.playerId) {
          setGameState(response.gameState);
          setUserId(response.playerId);
          setSelectedGameMode('multiplayer');
          setLobbyScreen('in_game_lobby'); // Or 'waiting_for_players'
          setLobbyMessage(response.message);
        } else {
          setLobbyMessage(`Failed to join: ${response.message}`);
        }
      });
    } else {
      setLobbyMessage('Invalid game link or ID format.');
    }
  };
  
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.startsWith('#join?gameId=')) {
        const gameId = window.location.hash.substring('#join?gameId='.length);
        if (selectedGameMode !== 'multiplayer' || lobbyScreen === 'initial') { // Avoid disrupting active join/host
            handleModeSelect('multiplayer'); // This will connect socket
            // Wait for socket to connect before navigating further
            const tryNavigate = setInterval(() => {
                if (socketRef.current?.connected) {
                    clearInterval(tryNavigate);
                    setPlayerNameInput(`Player${Math.floor(Math.random() * 1000)}`); // Set a default name
                    setJoinLinkInput(window.location.href); 
                    navigateToJoinScreen(); // This will show the input field with the link
                    setLobbyMessage(`To join game ${gameId} from URL, confirm your name and click "Join Game".`);
                }
            }, 100);
            setTimeout(() => clearInterval(tryNavigate), 5000); // Timeout if socket doesn't connect
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange, false);
    handleHashChange(); 

    return () => {
      window.removeEventListener('hashchange', handleHashChange, false);
    };
  }, []); // Run once to setup hash listening

  const handleStartMultiplayerGame = () => {
    if (!socketRef.current || !gameState?.gameId || !userId) return;
    socketRef.current.emit('start-game-request', { gameId: gameState.gameId, playerId: userId });
  };


  // Player Actions (to be sent to server in multiplayer)
  const sendPlayerActionToServer = (action: PlayerActionPayload) => {
    if (selectedGameMode === 'multiplayer' && socketRef.current && gameState?.gameId && userId) {
      socketRef.current.emit('player-action', {
        gameId: gameState.gameId,
        playerId: userId,
        action
      });
      // Optimistic UI updates can be tricky, usually wait for server's game-state-update
      // For now, clear targeting and disable further actions until server responds
      setGameState(prev => prev ? ({ ...prev, targetSelection: null, turnActionDone: true, message: "Action sent. Waiting for server..." }) : null);
      setIsDiscardModeActive(false);
    }
  };


  const handleInitiatePlayCard = (card: GameCard, player: Player) => {
    if (!gameState || gameState.gamePhase === GamePhase.GAME_OVER || gameState.gamePhase === GamePhase.ROUND_OVER ) return;
    
    if (player.id !== userId && selectedGameMode === 'multiplayer') { // Check against current socket's player ID
         setGameState(prev => gameService.addLogEntry(prev!, "Not your turn (Multiplayer).")); return;
    }
    if (player.id !== gameState.players[gameState.currentPlayerIndex].id) {
      setGameState(prev => gameService.addLogEntry(prev!, "It's not your turn to play a card."));
      return;
    }

    if (gameState.targetSelection && gameState.targetSelection.cardPlayed.id === card.id) {
      // Cancel targeting
      setGameState(prev => ({
        ...prev!,
        targetSelection: null,
        gamePhase: GamePhase.PLAYING,
        message: `${player.name}'s turn. Select a card or action.`
      }));
      setIsDiscardModeActive(false); 
      return;
    }
    
    if (gameState.targetSelection || gameState.turnActionDone) {
        setGameState(prev => gameService.addLogEntry(prev!, "An action is already in progress or your turn action is done."));
        return;
    }
    setIsDiscardModeActive(false);

    // For single player, set up local targeting.
    // For multiplayer, this targeting setup is for UI only; actual effect happens on server.
    // The onSelect for multiplayer will call sendPlayerActionToServer.
    let nextPhase = GamePhase.PLAYING;
    let targetSelection: TargetSelection | null = null;

    switch (card.type) {
      case CardType.PLANT:
        targetSelection = {
          cardPlayed: card, sourcePlayerId: player.id, targetType: 'any_empty_pot', 
          onSelect: (targetPotOwnerPlayerId, potIndex) => { 
            if (potIndex === undefined || !targetPotOwnerPlayerId) return;
            if (selectedGameMode === 'single') {
                setGameState(prev => gameService.playPlantCardLogic(prev!, player.id, card.id, targetPotOwnerPlayerId, potIndex));
            } else {
                sendPlayerActionToServer({ actionType: 'play_card', cardId: card.id, targetPlayerId: targetPotOwnerPlayerId, potIndex });
            }
          },
          message: "Select an empty pot on ANY player's board for your plant.", allowedPotContent: 'empty',
        };
        nextPhase = GamePhase.TARGETING_PLAYER_POT; 
        break;
      case CardType.POWER:
        const powerCard = card as PowerCard;
        switch (powerCard.name) {
          case PowerCardName.DANDELION:
            targetSelection = {
              cardPlayed: card, sourcePlayerId: player.id, targetType: 'opponent_pot_empty', 
              onSelect: (targetPotOwnerPlayerId, potIndex) => {
                if (potIndex === undefined || !targetPotOwnerPlayerId) return;
                 if (targetPotOwnerPlayerId === player.id) { /* UI validation */ return; }
                if (selectedGameMode === 'single') {
                    setGameState(prev => gameService.playDandelionCardLogic(prev!, player.id, card.id, targetPotOwnerPlayerId, potIndex));
                } else {
                    sendPlayerActionToServer({ actionType: 'play_card', cardId: card.id, targetPlayerId: targetPotOwnerPlayerId, potIndex });
                }
              },
              message: "Select an OPPONENT'S empty pot.", allowedPotContent: 'empty',
            };
            nextPhase = GamePhase.TARGETING_PLAYER_POT;
            break;
          case PowerCardName.WEED_KILLER:
             targetSelection = {
              cardPlayed: card, sourcePlayerId: player.id, targetType: 'self_pot_dandelion',
              onSelect: (_, potIndex) => {
                if (potIndex === undefined) return;
                if (selectedGameMode === 'single') {
                    setGameState(prev => gameService.playWeedKillerLogic(prev!, player.id, card.id, potIndex!));
                } else {
                    sendPlayerActionToServer({ actionType: 'play_card', cardId: card.id, potIndex });
                }
              },
              message: 'Select one of YOUR Dandelions.', allowedPotContent: 'dandelion',
            };
            nextPhase = GamePhase.TARGETING_SELF_POT;
            break;
          case PowerCardName.COMPOST:
            targetSelection = {
              cardPlayed: card, sourcePlayerId: player.id, targetType: 'self_pot_plant',
              onSelect: (_, potIndex) => {
                if (potIndex === undefined) return;
                 if (selectedGameMode === 'single') {
                    setGameState(prev => gameService.playCompostLogic(prev!, player.id, card.id, potIndex!));
                 } else {
                    sendPlayerActionToServer({ actionType: 'play_card', cardId: card.id, potIndex });
                 }
              },
              message: 'Select one of YOUR weed plants.', allowedPotContent: 'plant',
            };
            nextPhase = GamePhase.TARGETING_SELF_POT;
            break;
          case PowerCardName.STEAL:
            targetSelection = {
              cardPlayed: card, sourcePlayerId: player.id, targetType: 'player_pot', 
              onSelect: (targetPlayerIdForStolenPot, targetPotIndex) => { 
                 if (targetPotIndex === undefined || !targetPlayerIdForStolenPot) return;
                 const targetPlayerName = gameState!.players.find(p=>p.id===targetPlayerIdForStolenPot)?.name || 'Opponent';
                 const newTargetSelectionForSelf: TargetSelection = {
                    cardPlayed: card, sourcePlayerId: player.id, targetType: 'self_pot_empty', 
                    onSelect: (_selfTargetId, selfPotIndex) => {
                        if (selfPotIndex === undefined) return;
                        if (selectedGameMode === 'single') {
                            setGameState(prev => gameService.playStealLogic(prev!, player.id, card.id, targetPlayerIdForStolenPot, targetPotIndex, selfPotIndex));
                        } else {
                            sendPlayerActionToServer({ actionType: 'play_card', cardId: card.id, targetPlayerId: targetPlayerIdForStolenPot, potIndex: targetPotIndex, selfPotIndex });
                        }
                    },
                    message: `Stealing from ${targetPlayerName}. Select YOUR empty pot.`, allowedPotContent: 'empty',
                 };
                 setGameState(prev => ({...prev!, gamePhase: GamePhase.TARGETING_SELF_POT, targetSelection: newTargetSelectionForSelf }));
              },
              message: 'Select an opponent\'s pot (with a plant).', allowedPotContent: 'plant', 
            };
            nextPhase = GamePhase.TARGETING_PLAYER_POT;
            break;
          // Player targeting cards
          case PowerCardName.HIPPIE_POWER:
          case PowerCardName.BUSTED:
          case PowerCardName.POTZILLA:
            targetSelection = {
              cardPlayed: card, sourcePlayerId: player.id, targetType: 'player',
              onSelect: (targetPlayerId) => {
                if(!targetPlayerId) return;
                if (selectedGameMode === 'single') {
                    if (powerCard.name === PowerCardName.HIPPIE_POWER) setGameState(prev => gameService.playHippiePowerLogic(prev!, player.id, card.id, targetPlayerId));
                    else if (powerCard.name === PowerCardName.BUSTED) setGameState(prev => gameService.playBustedLogic(prev!, player.id, card.id, targetPlayerId));
                    else if (powerCard.name === PowerCardName.POTZILLA) setGameState(prev => gameService.playPotzillaLogic(prev!, player.id, card.id, targetPlayerId));
                } else {
                     sendPlayerActionToServer({ actionType: 'play_card', cardId: card.id, targetPlayerId: targetPlayerId });
                }
              },
              message: `Select a player for ${powerCard.name}.`,
            };
            nextPhase = GamePhase.TARGETING_PLAYER;
            break;
          default: nextPhase = GamePhase.PLAYING; break; 
        }
        break;
      default: nextPhase = GamePhase.PLAYING; break;
    }
    setGameState(prev => ({ ...prev!, gamePhase: nextPhase, targetSelection }));
  };

  const handleCardClickInHand = (card: GameCard, player: Player) => {
    if (!gameState || player.id !== userId && selectedGameMode === 'multiplayer') return; // Only current user can interact with their hand
    if (player.id !== gameState.players[gameState.currentPlayerIndex].id ) {
        if (gameState.targetSelection?.cardPlayed.id === card.id) { handleInitiatePlayCard(card, player); }
        return;
    }
    if (gameState.turnActionDone && selectedGameMode === 'single') return;


    if (isDiscardModeActive) {
      if (selectedGameMode === 'single') {
        setGameState(prev => gameService.discardCardLogic(prev!, player.id, card.id));
      } else {
        sendPlayerActionToServer({actionType: 'discard_card', cardId: card.id});
      }
      setIsDiscardModeActive(false); 
    } else {
      handleInitiatePlayCard(card, player);
    }
  };

  // Single player turn end logic
  const singlePlayerEndTurnLogic = useCallback(() => {
    setIsDiscardModeActive(false); 
    setGameState(prev => {
      if (!prev) return prev;
      let nextState = { ...prev }; 
      const roundEndedByCondition = gameService.checkForRoundEnd(nextState);
      if (roundEndedByCondition) {
        nextState = gameService.calculateRoundScores(nextState);
        nextState = gameService.determineRoundWinner(nextState);
        const gameWinner = gameService.checkForGameEnd(nextState);
        if (gameWinner) {
          nextState.gamePhase = GamePhase.GAME_OVER;
          nextState.gameWinner = gameWinner;
          nextState = gameService.addLogEntry(nextState, `${gameWinner.name} wins the game with ${gameWinner.score} points!`);
        } else {
          nextState.gamePhase = GamePhase.ROUND_OVER;
        }
      } else {
        nextState = gameService.advanceTurn(nextState);
      }
      isProcessingAiTurnRef.current = false; 
      return nextState;
    });
  }, []); 


  const handleTargetPlayerSelect = (targetPlayer: Player) => {
    const currentTargetSelection = gameState?.targetSelection;
    if (currentTargetSelection && typeof currentTargetSelection.onSelect === 'function' && currentTargetSelection.targetType === 'player') {
      currentTargetSelection.onSelect(targetPlayer.id);
    }
  };

  const handleTargetPlayerPotSelect = (targetPlayer: Player, potIndex: number) => {
    const currentTargetSelection = gameState?.targetSelection;
    const expectedTargetTypes = ['player_pot', 'opponent_pot_empty', 'any_empty_pot'];
    if (currentTargetSelection && typeof currentTargetSelection.onSelect === 'function' && 
        expectedTargetTypes.includes(currentTargetSelection.targetType)) {
      currentTargetSelection.onSelect(targetPlayer.id, potIndex);
    }
  };
  
  const handleTargetSelfPotSelect = (playerWhosePotWasClicked: Player, potIndex: number) => { 
    const currentTargetSelection = gameState?.targetSelection;
    if (currentTargetSelection && typeof currentTargetSelection.onSelect === 'function' && 
        currentTargetSelection.targetType.startsWith('self_pot')) { 
      currentTargetSelection.onSelect(playerWhosePotWasClicked.id, potIndex);
    }
  };

  const handleModalClose = () => {
    if (!gameState) return;
    setIsDiscardModeActive(false);
    if (selectedGameMode === 'single') {
        if (gameState.gamePhase === GamePhase.ROUND_OVER) {
            setGameState(gameService.startNewRound(gameState));
        } else if (gameState.gamePhase === GamePhase.GAME_OVER) {
            setSelectedGameMode(null);
            setGameState(null); 
        }
        isProcessingAiTurnRef.current = false;
    } else { // Multiplayer: Server handles round/game end state changes
        if (gameState.gamePhase === GamePhase.GAME_OVER) {
            handleBackToModeSelection(); // Go back to lobby after MP game over
        }
        // For round over in MP, server would send new state for new round
    }
  };
  
  // Cleanup AI timeout
  useEffect(() => {
    return () => { if (aiActionTimeoutRef.current) clearTimeout(aiActionTimeoutRef.current); };
  }, []);

  // AI Turn Logic (Single Player)
  useEffect(() => {
    if (selectedGameMode !== 'single' || !gameState || gameState.gamePhase !== GamePhase.PLAYING || gameState.targetSelection || isDiscardModeActive) {
      return;
    }
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id === userId || isProcessingAiTurnRef.current) return;

    isProcessingAiTurnRef.current = true;
    aiActionTimeoutRef.current = setTimeout(() => {
      setGameState(prev => {
        if (!prev) { isProcessingAiTurnRef.current = false; return null; }
        const currentGS = prev;
        if (currentGS.players[currentGS.currentPlayerIndex].id === userId || currentGS.gamePhase !== GamePhase.PLAYING || currentGS.targetSelection || !isProcessingAiTurnRef.current || isDiscardModeActive) {
             isProcessingAiTurnRef.current = false; return prev;
        }
        const aiPlayer = currentGS.players[currentGS.currentPlayerIndex];
        const aiDecision = aiService.makeAIMove(currentGS, aiPlayer, currentGS.players);
        let nextState = { ...currentGS };
        if (aiDecision) { /* Apply AI decision using gameService functions... */ 
            switch (aiDecision.type) {
                case 'PLAY_PLANT': nextState = gameService.playPlantCardLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.targetPlayerIdForPot, aiDecision.potIndex); break;
                case 'PLAY_DANDELION': nextState = gameService.playDandelionCardLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.targetPlayerIdForPot, aiDecision.potIndex); break;
                case 'PLAY_WEED_KILLER': nextState = gameService.playWeedKillerLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.potIndex); break;
                case 'PLAY_COMPOST': nextState = gameService.playCompostLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.potIndex); break;
                case 'PLAY_STEAL': nextState = gameService.playStealLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.targetPlayerId, aiDecision.targetPotIndex, aiDecision.selfPotIndex); break;
                case 'PLAY_HIPPIE_POWER': nextState = gameService.playHippiePowerLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.targetPlayerId); break;
                case 'PLAY_BUSTED': nextState = gameService.playBustedLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.targetPlayerId); break;
                case 'PLAY_POTZILLA': nextState = gameService.playPotzillaLogic(nextState, aiPlayer.id, aiDecision.cardId, aiDecision.targetPlayerId); break;
                case 'DISCARD_CARD': nextState = gameService.discardCardLogic(nextState, aiPlayer.id, aiDecision.cardId); break;
                case 'END_TURN': 
                  if (!nextState.turnActionDone) {
                     nextState = gameService.addLogEntry(nextState, `${aiPlayer.name} couldn't make a move and ends turn.`);
                     nextState.turnActionDone = true; 
                  } break;
            }
        } else { 
            nextState = gameService.addLogEntry(nextState, `${aiPlayer.name} has no valid moves, ends turn.`);
            nextState.turnActionDone = true; 
        }
        if (!nextState.turnActionDone && !nextState.targetSelection) { nextState.turnActionDone = true; }
        return nextState;
      });
    }, AI_THINK_DELAY);
  }, [gameState, userId, selectedGameMode, isDiscardModeActive]); 

  // Auto-end turn if no cards and no draw pile (Single Player)
  useEffect(() => {
    if (selectedGameMode === 'single' && gameState && gameState.gamePhase === GamePhase.PLAYING && !gameState.turnActionDone && !gameState.targetSelection && !isDiscardModeActive) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.hand.length === 0 && gameState.drawPile.length === 0) {
        setGameState(prev => {
            if (!prev) return null;
            const stillApplies = prev.players[prev.currentPlayerIndex].id === currentPlayer.id && 
                                 prev.players[prev.currentPlayerIndex].hand.length === 0 && 
                                 prev.drawPile.length === 0 && !prev.turnActionDone &&
                                 !prev.targetSelection && !isDiscardModeActive && 
                                 prev.gamePhase === GamePhase.PLAYING;
            if (stillApplies) {
              let nextState = gameService.addLogEntry(prev, `${currentPlayer.name} has no cards and cannot draw. Turn 'done'.`);
              return { ...nextState, turnActionDone: true }; 
            } return prev;
        });
      }
    }
  }, [gameState, isDiscardModeActive, selectedGameMode]); 

  // Auto-advance turn after action (Single Player)
  useEffect(() => {
    if (selectedGameMode === 'single' && gameState && gameState.turnActionDone && !gameState.targetSelection && !isDiscardModeActive && gameState.gamePhase === GamePhase.PLAYING) {
      const currentPlayerIsHuman = gameState.players[gameState.currentPlayerIndex].id === userId;
      const delay = currentPlayerIsHuman ? 500 : 0; 
      const timeoutId = setTimeout(() => { singlePlayerEndTurnLogic(); }, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [gameState?.turnActionDone, gameState?.targetSelection, gameState?.gamePhase, gameState?.players, userId, singlePlayerEndTurnLogic, isDiscardModeActive, selectedGameMode]);


  if (!selectedGameMode) {
    return <GameModeSelection onSelectMode={handleModeSelect} />;
  }

  if (selectedGameMode === 'multiplayer' && (!gameState || lobbyScreen !== 'in_game_lobby' && gameState.gamePhase !== GamePhase.PLAYING && gameState.gamePhase !== GamePhase.ROUND_OVER && gameState.gamePhase !== GamePhase.GAME_OVER)) {
    return <MultiplayerLobby 
              onBack={handleBackToModeSelection}
              lobbyScreen={lobbyScreen}
              hostedGameLink={hostedGameLink}
              joinLinkInput={joinLinkInput}
              lobbyMessage={lobbyMessage}
              playerNameInput={playerNameInput}
              onPlayerNameChange={setPlayerNameInput}
              onHostGame={handleHostGame}
              onNavigateToJoinScreen={navigateToJoinScreen}
              onJoinGameAttempt={handleJoinGameAttempt}
              onJoinLinkInputChange={setJoinLinkInput}
              onSetLobbyScreen={setLobbyScreen} 
              onStartGame={handleStartMultiplayerGame}
              isHost={gameState?.players.find(p=>p.id === userId)?.isHost || false}
              canStartGame={gameState?.players.length ? gameState.players.length >= 2 : false} // Simple condition for host
            />;
  }

  if (!gameState && selectedGameMode === 'single') {
    return <GameSetup onSetupComplete={initGame} />;
  }
  
  if (!gameState) { // Should be covered by multiplayer lobby or single player setup
      setSelectedGameMode(null); 
      return <GameModeSelection onSelectMode={handleModeSelect} />;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurnForUI = currentPlayer.id === userId; // Used for UI enablement like discard button
  const canPlayerDiscard = (isMobile || (!isMobile && isMyTurnForUI)) && !currentPlayer.isSkipped && !gameState.targetSelection && !gameState.turnActionDone;

  return (
    <>
      {gameState.gamePhase === GamePhase.GAME_OVER && gameState.gameWinner && <Confetti isActive={true} />}
      <GameBoard
        gameState={gameState}
        onCardClickInHand={handleCardClickInHand}
        onToggleDiscardMode={handleToggleDiscardMode}
        isDiscardModeActive={isDiscardModeActive}
        canPlayerDiscard={canPlayerDiscard}
        onPlayerTargetSelect={handleTargetPlayerSelect}
        onPlayerPotTargetSelect={handleTargetPlayerPotSelect} 
        onSelfPotTargetSelect={handleTargetSelfPotSelect} 
        userId={userId} // This is the client's player ID (socket ID in MP)
        isMobile={isMobile}
        onToggleRulesModal={handleToggleRulesModal}
      />
      {/* Modals for Round Over / Game Over (shared for SP and MP, content driven by gameState) */}
      <Modal
        isOpen={gameState.gamePhase === GamePhase.ROUND_OVER}
        title="Round Over!"
        onClose={handleModalClose}
        closeButtonText={selectedGameMode === 'single' ? "Start Next Round" : "Waiting for Host..."}
        showCloseButton={selectedGameMode === 'single' || (gameState.players.find(p => p.id === userId)?.isHost || false)}
      >
        <p className="text-xl mb-2">
          {gameState.roundWinner
            ? `${gameState.roundWinner.name} had the most plants this round (${gameState.roundWinner.roundScore})!`
            : "Round ended. Points tallied!"}
        </p>
        <h4 className="text-lg font-semibold mb-2">Round Scores:</h4>
        <ul className="list-disc list-inside text-left mx-auto max-w-xs">
          {gameState.players.map(p => (
            <li key={p.id}>{p.name}: {p.roundScore} plants (Total: {p.score})</li>
          ))}
        </ul>
      </Modal>
      <Modal
        isOpen={gameState.gamePhase === GamePhase.GAME_OVER}
        title="Game Over!"
        onClose={handleModalClose}
        closeButtonText="Back to Menu"
      >
        <p className="text-2xl mb-4 font-bold text-emerald-600">
            {gameState.gameWinner ? 
                `${gameState.gameWinner.name}, congratulations you are the Real Potzilla!` :
                "The game has concluded!"}
        </p>
        <h4 className="text-lg font-semibold mb-2">Final Scores:</h4>
        <ul className="list-disc list-inside text-left mx-auto max-w-xs">
          {gameState.players.map(p => (
            <li key={p.id}>{p.name}: {p.score} points</li>
          ))}
        </ul>
      </Modal>
      <Modal
        isOpen={showRulesModal}
        title="Game Rules"
        onClose={handleToggleRulesModal}
      >
        <div className="text-left space-y-3 max-h-[60vh] overflow-y-auto pr-2 text-sm sm:text-base">
          <p><strong>Objective:</strong> Be the first player to reach 50 points by planting and harvesting Weed Plant cards.</p>
          <p><strong>Setup:</strong></p>
          <ul className="list-disc list-inside ml-4">
              <li>Each player starts with 5 cards in hand and 5 empty pots.</li>
              <li>The remaining cards form the draw pile.</li>
          </ul>
          <p><strong>Player Turn:</strong></p>
          <ul className="list-disc list-inside ml-4">
              <li>On your turn, you must perform one action:</li>
              <li className="ml-4"><strong>Play a Card:</strong>
                  <ul className="list-circle list-inside ml-4">
                      <li><strong>Plant Card:</strong> Play into any empty pot (yours or an opponent's).</li>
                      <li><strong>Power Card:</strong> Follow the card's instructions. Some require targeting.</li>
                  </ul>
              </li>
              <li className="ml-4"><strong>Discard a Card:</strong> If you cannot or choose not to play a card, you may discard one card from your hand. You will then draw a new card if the draw pile is not empty.</li>
              <li>After playing or discarding (and potentially drawing a new card), your turn ends. (In Single Player, it's automatic. In Multiplayer, server advances turn.)</li>
          </ul>
          <p><strong>Pots & Plants:</strong></p>
          <ul className="list-disc list-inside ml-4">
              <li>Each pot can hold one card.</li>
              <li>Weed Plant cards in pots contribute to your round score.</li>
              <li>Dandelion cards in pots score 0 and block that pot for win conditions.</li>
          </ul>
          <p><strong>Ending a Round:</strong> A round ends when EITHER:</p>
          <ul className="list-disc list-inside ml-4">
              <li>Any player fills all 5 of their pots exclusively with Weed Plant cards.</li>
              <li>OR the draw pile is empty, and all players have no cards left in their hands.</li>
          </ul>
          <p><strong>Scoring:</strong></p>
          <ul className="list-disc list-inside ml-4">
              <li>At the end of each round, players sum the values of Weed Plant cards in their pots. This is their score for the round.</li>
              <li>This round score is added to their total game score.</li>
          </ul>
          <p><strong>Winning the Game:</strong></p>
          <ul className="list-disc list-inside ml-4">
              <li>The first player to reach or exceed 50 total points at the end of a round wins the game!</li>
          </ul>
          <p><strong>Power Cards (Examples):</strong></p>
          <ul className="list-disc list-inside ml-4">
              <li><strong>Steal:</strong> Take a planted pot from an opponent (if you have an empty pot).</li>
              <li><strong>Hippie Power:</strong> Destroy an opponent's smallest plant pot.</li>
              <li><strong>Busted:</strong> Destroy an opponent's largest plant pot and skip their next turn.</li>
              <li><strong>Compost:</strong> Double the value of one of your plant pots.</li>
              <li><strong>Potzilla:</strong> Destroy all of an opponent's pots.</li>
              <li><strong>Dandelion:</strong> Plant a useless Dandelion in an opponent's empty pot.</li>
              <li><strong>Weed Killer:</strong> Remove a Dandelion from one of your pots.</li>
          </ul>
          <p className="italic mt-4">Have fun and may the best grower win!</p>
        </div>
      </Modal>
      <div style={{ position: 'fixed', bottom: '5px', left: '5px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '10px', zIndex: 9999, textShadow: '1px 1px 2px black' }}>
        Version 1.1
      </div>
    </>
  );
};

export default App;
