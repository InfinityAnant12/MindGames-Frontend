

import React from 'react';
import ActionButton from './ActionButton';
import Logo from './Logo';

interface GameModeSelectionProps {
  onSelectMode: (mode: 'single' | 'multiplayer') => void;
}

const GameModeSelection: React.FC<GameModeSelectionProps> = ({ onSelectMode }) => {
  const handleMultiplayerClick = () => {
    onSelectMode('multiplayer'); 
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-300 via-emerald-500 to-teal-700 p-6">
      <div className="bg-white/90 backdrop-blur-md p-8 sm:p-10 rounded-xl shadow-2xl text-center max-w-md w-full">
        <div className="mb-4 sm:mb-6">
            <Logo />
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-semibold mb-6 sm:mb-8 text-gray-700">Choose Your Game Mode</h2>
        
        <div className="space-y-4">
          <ActionButton 
            onClick={() => onSelectMode('single')} 
            className="w-full text-lg py-3"
            variant="primary"
          >
            Single Player (vs. AI)
          </ActionButton>
          
          <ActionButton 
            onClick={handleMultiplayerClick} 
            className="w-full text-lg py-3"
            variant="secondary"
          >
            Multiplayer (Link-based)
          </ActionButton>
        </div>
      </div>
       <footer className="mt-8 text-center text-emerald-100 text-sm">
        <p>&copy; 2025 Infinity High Games. For entertainment purposes only.</p>
      </footer>
    </div>
  );
};

export default GameModeSelection;