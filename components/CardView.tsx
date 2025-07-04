
import React from 'react';
import { GameCard, CardType, PlantCard, PowerCard, PowerCardName } from '../types';

interface CardViewProps {
  card: GameCard | null;
  onClick?: () => void;
  className?: string;
  isPlayable?: boolean;
}

const getCardImageUrl = (card: GameCard): string => {
  const basePath = '/assets/cards/';
  if (card.type === CardType.PLANT) {
    const plantCard = card as PlantCard;
    // Assuming images are named plant_1.png, plant_2.png, etc.
    return `${basePath}plant_${plantCard.originalPlants}.png`;
  }
  
  const powerCard = card as PowerCard;
  const nameMap: { [key in PowerCardName]?: string } = {
    [PowerCardName.STEAL]: 'steal.png',
    [PowerCardName.HIPPIE_POWER]: 'hippie.png',
    [PowerCardName.BUSTED]: 'busted.png',
    [PowerCardName.COMPOST]: 'compost.png',
    [PowerCardName.POTZILLA]: 'potzilla.png',
    [PowerCardName.DANDELION]: 'dendeline.png', // Sticking to original filename
    [PowerCardName.WEED_KILLER]: 'weed killer.png',
  };

  const imageName = nameMap[powerCard.name];
  if (imageName) {
    return `${basePath}${imageName}`;
  }

  // Fallback for unknown cards, maybe a generic card back
  return `${basePath}card_back.png`; 
};


const CardView: React.FC<CardViewProps> = ({ card, onClick, className = '', isPlayable = false }) => {
  if (!card) {
    return (
      <div className={`bg-gray-700 border-2 border-gray-500 rounded-lg flex items-center justify-center text-gray-400 shadow-md ${className}`}>
        Empty
      </div>
    );
  }

  // Special rendering for the draw pile counter card
  if (card.type === CardType.POWER && (card as PowerCard).name === "Pile" as PowerCardName) {
      const descriptionParts = card.description.split(' ');
      const count = descriptionParts[0];
      const isSmallContext = className.includes('w-16') || className.includes('w-20') || className.includes('w-24');
      return (
          <div className={`border-2 rounded-lg shadow-lg flex flex-col items-center justify-center p-1 ${className} bg-gray-800 border-gray-600 text-gray-300`}>
              <div className={`font-semibold ${isSmallContext ? 'text-[10px]' : 'text-xs'}`}>Draw Pile</div>
              <div className={`my-1 ${isSmallContext ? 'text-2xl' : 'text-3xl'}`}>📚</div>
              <div className={`${isSmallContext ? 'text-[10px]' : 'text-xs'}`}>{count} left</div>
          </div>
      );
  }
  
  const baseClasses = `border-2 border-gray-500 rounded-lg shadow-lg select-none overflow-hidden bg-transparent text-white relative ${className}`;
  const clickableClasses = onClick && isPlayable ? 'cursor-pointer card hover:border-amber-400' : '';
  const imageUrl = getCardImageUrl(card);
  const cardName = card.type === CardType.PLANT ? `${(card as PlantCard).originalPlants} Plant Card` : (card as PowerCard).name;

  return (
    <div
      className={`${baseClasses} ${clickableClasses}`}
      onClick={onClick}
      title={card.description}
    >
      <img src={imageUrl} alt={cardName} className="w-full h-full object-cover" />
    </div>
  );
};

export default CardView;
