
import React, { useState } from 'react';
import ActionButton from './ActionButton';

type LobbyScreen = 'initial' | 'hosting' | 'joining' | 'waiting_for_host' | 'waiting_for_players' | 'in_game_lobby'; // Added 'in_game_lobby'

interface MultiplayerLobbyProps {
  onBack: () => void;
  lobbyScreen: LobbyScreen;
  hostedGameLink: string | null;
  joinLinkInput: string;
  lobbyMessage: string;
  playerNameInput: string;
  onPlayerNameChange: (name: string) => void;
  onHostGame: () => void;
  onNavigateToJoinScreen: () => void;
  onJoinGameAttempt: () => void;
  onJoinLinkInputChange: (value: string) => void;
  onSetLobbyScreen: (screen: LobbyScreen) => void;
  onStartGame: () => void; // New prop for host to start game
  isHost: boolean; // Is the current client the host?
  canStartGame: boolean; // Can the game be started (e.g., enough players)?
}

const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onBack,
  lobbyScreen,
  hostedGameLink,
  joinLinkInput,
  lobbyMessage,
  playerNameInput,
  onPlayerNameChange,
  onHostGame,
  onNavigateToJoinScreen,
  onJoinGameAttempt,
  onJoinLinkInputChange,
  onSetLobbyScreen,
  onStartGame,
  isHost,
  canStartGame
}) => {
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = async () => {
    if (hostedGameLink) {
      try {
        await navigator.clipboard.writeText(hostedGameLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy link: ', err);
        alert('Failed to copy link. Please copy it manually.');
      }
    }
  };

  const commonNameInput = (
    <div className="mb-6">
      <label htmlFor="playerNameLobby" className="block text-lg font-medium text-gray-700 mb-2">
        Your Name:
      </label>
      <input
        type="text"
        id="playerNameLobby"
        value={playerNameInput}
        onChange={(e) => onPlayerNameChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
        placeholder="Enter your name for multiplayer"
      />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6">
      <div className="bg-white/95 backdrop-blur-lg p-8 sm:p-10 rounded-xl shadow-2xl text-center max-w-lg w-full">
        
        {lobbyScreen === 'initial' && (
          <>
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-purple-700">Multiplayer Lobby</h1>
            {commonNameInput}
            <p className="text-gray-700 mb-8 text-lg">
              Host a new game or join an existing one using a shareable link.
            </p>
            <div className="space-y-4">
              <ActionButton 
                onClick={onHostGame} 
                className="w-full text-lg py-3" 
                variant="primary"
                disabled={!playerNameInput.trim()}
              >
                Host New Game
              </ActionButton>
              <ActionButton 
                onClick={onNavigateToJoinScreen}
                className="w-full text-lg py-3" 
                variant="secondary"
                disabled={!playerNameInput.trim()}
              >
                Join Game with Link
              </ActionButton>
            </div>
            {lobbyMessage && <p className="text-gray-600 mt-4 italic min-h-[1.5em]">{lobbyMessage}</p>}
          </>
        )}

        {lobbyScreen === 'hosting' && hostedGameLink && (
          <>
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-purple-700">Game Hosted!</h1>
            <p className="text-gray-700 mb-2 text-md">Welcome, {playerNameInput} (Host)!</p>
            <p className="text-gray-700 mb-4 text-lg">Share this link with your friends:</p>
            <div className="mb-4 p-3 bg-purple-100 rounded-md shadow-sm text-purple-700 break-all select-all">
              {hostedGameLink}
            </div>
            <ActionButton 
              onClick={handleCopyLink} 
              className="w-full text-lg py-3 mb-4" 
              variant="primary"
            >
              {linkCopied ? 'Link Copied!' : 'Copy Link'}
            </ActionButton>
            <p className="text-gray-600 mb-6 italic min-h-[2em]">{lobbyMessage || 'Waiting for players to join...'}</p>
            {isHost && (
                <ActionButton 
                    onClick={onStartGame} 
                    className="w-full text-lg py-3" 
                    variant="primary"
                    disabled={!canStartGame}
                >
                    {canStartGame ? 'Start Game' : 'Waiting for more players...'}
                </ActionButton>
            )}
          </>
        )}

        {lobbyScreen === 'joining' && (
           <>
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-purple-700">Join Game</h1>
            {/* Player name is confirmed before this screen, so not shown here again */}
            <p className="text-gray-700 mb-4 text-lg">Enter the game link provided by the host:</p>
            <input
                type="text"
                value={joinLinkInput}
                onChange={(e) => onJoinLinkInputChange(e.target.value)}
                placeholder="Paste game link here"
                className="w-full px-3 py-2 mb-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            />
            <ActionButton 
              onClick={onJoinGameAttempt} 
              className="w-full text-lg py-3" 
              variant="primary"
            >
              Join Game
            </ActionButton>
            {lobbyMessage && <p className="text-gray-600 mt-4 italic">{lobbyMessage}</p>}
          </>
        )}
        
        {(lobbyScreen === 'waiting_for_host' || lobbyScreen === 'waiting_for_players') && (
            <>
                <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-purple-700">
                    {lobbyScreen === 'waiting_for_host' ? "Waiting for Host" : "Waiting for Other Players"}
                </h1>
                <p className="text-gray-700 mb-2 text-md">Welcome, {playerNameInput}!</p>
                <div className="my-8 flex flex-col items-center justify-center space-y-3">
                    <svg className="animate-spin h-10 w-10 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-700 text-lg animate-pulse">
                        {lobbyMessage || "Connected to game lobby. Waiting..."}
                    </p>
                </div>
                 {!isHost && lobbyScreen === 'waiting_for_players' && (
                    <p className="text-sm text-gray-500 mt-4">Waiting for the host to start the game.</p>
                )}
                 {isHost && lobbyScreen === 'waiting_for_players' && (
                    <ActionButton 
                        onClick={onStartGame} 
                        className="w-full text-lg py-3 mt-4" 
                        variant="primary"
                        disabled={!canStartGame}
                    >
                         {canStartGame ? 'Start Game' : 'Waiting for more players...'}
                    </ActionButton>
                )}
            </>
        )}

        <ActionButton onClick={onBack} className="w-full text-lg py-3 mt-6" variant="danger">
          Back to Main Menu
        </ActionButton>
      </div>
       <footer className="mt-8 text-center text-purple-100 text-sm">
        <p>&copy; 2024 High Roller Games. Multiplayer features are under development.</p>
      </footer>
    </div>
  );
};

export default MultiplayerLobby;
