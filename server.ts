import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

import { GameState, ClientToServerEvents, ServerToClientEvents, GamePhase, CardType, PowerCard, PowerCardName } from './types';
import * as gameService from './services/gameService';
import { MAX_PLAYERS, MIN_PLAYERS } from './constants';

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity
    methods: ["GET", "POST"]
  }
});

const games: { [gameId: string]: GameState } = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('host-game', (playerName, callback) => {
    const gameId = uuidv4().substring(0, 6); // Short and sweet game ID
    const hostPlayer = gameService.createInitialPlayer(socket.id, playerName);
    hostPlayer.isHost = true;

    const initialGameState: GameState = {
      gameId: gameId,
      players: [hostPlayer],
      drawPile: [],
      discardPile: [],
      currentPlayerIndex: 0,
      gamePhase: GamePhase.MULTIPLAYER_LOBBY,
      roundWinner: null,
      gameWinner: null,
      gameLog: [`Game created by ${playerName}. Waiting for players...`],
      message: `Welcome, ${playerName}! Share the game link to invite others.`,
      targetSelection: null,
      turnActionDone: false,
    };

    games[gameId] = initialGameState;
    socket.join(gameId);
    console.log(`Game ${gameId} created by ${playerName} (${socket.id})`);
    callback({ gameId, playerId: socket.id, initialGameState });
  });

  socket.on('join-game', ({ gameId, playerName }, callback) => {
    const game = games[gameId];
    if (!game) {
      return callback({ success: false, message: 'Game not found.' });
    }
    if (game.players.length >= MAX_PLAYERS) {
      return callback({ success: false, message: 'Game room is full.' });
    }
    if (game.gamePhase !== GamePhase.MULTIPLAYER_LOBBY) {
        return callback({ success: false, message: 'Game has already started.' });
    }
    if (game.players.find(p => p.id === socket.id)) {
        // Player is already in the game, just re-sync them
        socket.join(gameId);
        return callback({ success: true, message: 'Rejoined game.', gameState: game, playerId: socket.id });
    }

    const newPlayer = gameService.createInitialPlayer(socket.id, playerName);
    game.players.push(newPlayer);
    game.gameLog.push(`${playerName} has joined the game.`);
    
    socket.join(gameId);
    io.to(gameId).emit('player-joined-room', { gameState: game });
    console.log(`${playerName} (${socket.id}) joined game ${gameId}`);
    callback({ success: true, message: 'Successfully joined game!', gameState: game, playerId: socket.id });
  });

  socket.on('start-game-request', ({ gameId, playerId }) => {
    const game = games[gameId];
    if (!game) return socket.emit('error-message', { message: 'Game not found.' });
    
    const host = game.players.find(p => p.isHost);
    if (!host || host.id !== playerId) {
      return socket.emit('error-message', { message: 'Only the host can start the game.' });
    }
    if (game.players.length < MIN_PLAYERS) {
      return socket.emit('error-message', { message: `Need at least ${MIN_PLAYERS} players to start.` });
    }

    // Initialize the game for real
    let startedGame = gameService.initializeGame(game.players.length, "Placeholder");
    // Transfer players, scores, and host status from lobby
    startedGame.players = game.players.map((lobbyPlayer, index) => {
        let gamePlayer = startedGame.players[index];
        gamePlayer.id = lobbyPlayer.id;
        gamePlayer.name = lobbyPlayer.name;
        gamePlayer.score = lobbyPlayer.score;
        gamePlayer.isHost = lobbyPlayer.isHost;
        return gamePlayer;
    });

    startedGame.gameId = gameId;
    startedGame.gamePhase = GamePhase.PLAYING;
    startedGame.gameLog = [...game.gameLog, `Game started by ${host.name}!`, `${startedGame.players[0].name}'s turn.`];
    startedGame.message = `${startedGame.players[0].name}'s turn. Select a card or action.`;
    
    games[gameId] = startedGame;
    io.to(gameId).emit('game-started', startedGame);
    console.log(`Game ${gameId} started.`);
  });

  socket.on('start-next-round', ({ gameId, playerId }) => {
    const game = games[gameId];
    if (!game) return socket.emit('error-message', { message: 'Game not found while trying to start next round.' });
    
    const host = game.players.find(p => p.isHost);
    if (!host || host.id !== playerId) {
      return socket.emit('error-message', { message: 'Only the host can start the next round.' });
    }
    if (game.gamePhase !== GamePhase.ROUND_OVER) {
      console.log(`Player ${playerId} tried to start next round for game ${gameId} but phase was ${game.gamePhase}`);
      return;
    }

    const nextRoundState = gameService.startNewRound(game);
    games[gameId] = nextRoundState;
    
    io.to(gameId).emit('game-state-update', nextRoundState);
    console.log(`Game ${gameId} advanced to next round by host ${host.name}.`);
  });

  socket.on('player-action', ({ gameId, playerId, action }) => {
    let game = games[gameId];
    if (!game) return;
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
        // It's not this player's turn
        return socket.emit('error-message', { message: "It's not your turn!" });
    }

    // --- Process Action ---
    // The gameService functions return a new state object.
    switch(action.actionType) {
        case 'discard_card':
            game = gameService.discardCardLogic(game, playerId, action.cardId);
            break;
        case 'play_card':
            const cardInHand = currentPlayer.hand.find(c => c.id === action.cardId);
            if (!cardInHand) return; // Card not in hand

            if (cardInHand.type === CardType.PLANT) {
                game = gameService.playPlantCardLogic(game, playerId, action.cardId, action.targetPlayerId!, action.potIndex!);
            } else { // Power card
                const powerCard = cardInHand as PowerCard;
                switch(powerCard.name) {
                    case PowerCardName.DANDELION:
                        game = gameService.playDandelionCardLogic(game, playerId, action.cardId, action.targetPlayerId!, action.potIndex!);
                        break;
                    case PowerCardName.WEED_KILLER:
                        game = gameService.playWeedKillerLogic(game, playerId, action.cardId, action.potIndex!);
                        break;
                    case PowerCardName.COMPOST:
                        game = gameService.playCompostLogic(game, playerId, action.cardId, action.potIndex!);
                        break;
                    case PowerCardName.STEAL:
                        game = gameService.playStealLogic(game, playerId, action.cardId, action.targetPlayerId!, action.potIndex!, action.selfPotIndex!);
                        break;
                    case PowerCardName.HIPPIE_POWER:
                        game = gameService.playHippiePowerLogic(game, playerId, action.cardId, action.targetPlayerId!);
                        break;
                    case PowerCardName.BUSTED:
                        game = gameService.playBustedLogic(game, playerId, action.cardId, action.targetPlayerId!);
                        break;
                    case PowerCardName.POTZILLA:
                        game = gameService.playPotzillaLogic(game, playerId, action.cardId, action.targetPlayerId!);
                        break;
                }
            }
            break;
    }

    // --- Post-Action Logic ---
    if (game.turnActionDone) {
        const roundEnded = gameService.checkForRoundEnd(game);
        if (roundEnded) {
            game = gameService.calculateRoundScores(game);
            game = gameService.determineRoundWinner(game);
            game = gameService.tallyScores(game); // Tally scores after finding winner
            const gameWinner = gameService.checkForGameEnd(game);
            if (gameWinner) {
                game.gamePhase = GamePhase.GAME_OVER;
                game.gameWinner = gameWinner;
                game = gameService.addLogEntry(game, `Game Over! ${gameWinner.name} wins with ${gameWinner.score} points!`);
            } else {
                game.gamePhase = GamePhase.ROUND_OVER;
            }
        } else {
            game = gameService.advanceTurn(game);
        }
    }
    
    games[gameId] = game; // Save the new state
    io.to(gameId).emit('game-state-update', game);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Find which game the player was in
    const gameId = Object.keys(games).find(id => games[id].players.some(p => p.id === socket.id));
    if (gameId) {
      let game = games[gameId];
      const leavingPlayer = game.players.find(p => p.id === socket.id);
      if (!leavingPlayer) return;

      console.log(`${leavingPlayer.name} is leaving game ${gameId}`);
      
      if (leavingPlayer.isHost) {
        // Host left, end the game
        io.to(gameId).emit('error-message', { message: 'The host has disconnected. The game has ended.' });
        delete games[gameId];
        console.log(`Host left. Game ${gameId} terminated.`);
      } else {
        // A regular player left
        game.players = game.players.filter(p => p.id !== socket.id);
        const message = `${leavingPlayer.name} has left the game.`;
        game.gameLog.push(message);

        // If the leaving player was the current player, advance the turn
        if (game.gamePhase === GamePhase.PLAYING && game.players.length > 0 && game.currentPlayerIndex >= game.players.length) {
             game.currentPlayerIndex = game.currentPlayerIndex % game.players.length;
             game = gameService.advanceTurn(game);
        }

        games[gameId] = game;
        io.to(gameId).emit('player-left-room', { gameState: game, message });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});