import React, { useState } from 'react';
import { MIN_PLAYERS, MAX_PLAYERS } from '../constants';
import ActionButton from './ActionButton';
import Logo from './Logo';

interface GameSetupProps {
  onSetupComplete: (numPlayers: number, playerName: string) => void;
}

const GameSetup: React.FC<GameSetupProps> = ({ onSetupComplete }) => {
  const [numPlayers, setNumPlayers] = useState<number>(MIN_PLAYERS);
  const [playerName, setPlayerName] = useState<string>('Player 1');

  const handleStartGame = () => {
    if (numPlayers >= MIN_PLAYERS && numPlayers <= MAX_PLAYERS && playerName.trim() !== '') {
      onSetupComplete(numPlayers, playerName.trim());
    } else if (playerName.trim() === '') {
      alert("Please enter a player name.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-400 to-emerald-600 p-6">
      <div className="bg-white/90 backdrop-blur-md p-8 sm:p-10 rounded-xl shadow-2xl text-center max-w-md w-full">
        <div className="mb-8 sm:mb-10">
          <Logo />
        </div>
        <h2 className="text-xl font-medium mb-6 text-emerald-700">Single Player Setup</h2>
        
        <p className="text-gray-600 mb-8">Compete to grow the most valuable weed farm against AI opponents! First to 50 points wins.</p>
        
        <div className="mb-6">
          <label htmlFor="playerName" className="block text-lg font-medium text-gray-700 mb-2">
            Your Name:
          </label>
          <input
            type="text"
            id="playerName"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            placeholder="Enter your name"
          />
        </div>

        <div className="mb-8">
          <label htmlFor="numPlayers" className="block text-lg font-medium text-gray-700 mb-2">
            Number of AI Opponents (Total Players: {numPlayers}):
          </label>
          <input
            type="range"
            id="numPlayers"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={numPlayers}
            onChange={(e) => setNumPlayers(parseInt(e.target.value, 10))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-gray-500 px-1 mt-1">
            <span>{MIN_PLAYERS} total ({MIN_PLAYERS -1} AI)</span>
            <span>{MAX_PLAYERS} total ({MAX_PLAYERS-1} AI)</span>
          </div>
           <p className="text-xs text-gray-500 mt-1">You will be Player 1.</p>
        </div>
        
        <ActionButton onClick={handleStartGame} className="w-full text-lg py-3">
          Start Game vs. AI
        </ActionButton>
      </div>
       <footer className="mt-8 text-center text-green-100 text-sm">
        <p>&copy; 2024 High Roller Games. For entertainment purposes only.</p>
      </footer>
    </div>
  );
};

export default GameSetup;
