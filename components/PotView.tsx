
import React from 'react';
import { Pot, PlantCard, PowerCardName, CardType, PowerCard } from '../types';
import CardView from './CardView';

interface PotViewProps {
  pot: Pot;
  onClick?: () => void;
  isTargetable?: boolean;
}

const PotView: React.FC<PotViewProps> = ({ pot, onClick, isTargetable = false }) => {
  const potSizeClasses = 'w-16 h-24 sm:w-20 sm:h-28 md:w-[5.5rem] md:h-[7.5rem] lg:w-24 lg:h-32'; 
  const potBaseClasses = `${potSizeClasses} border-2 border-yellow-700 bg-yellow-100 rounded-lg flex flex-col items-center justify-center p-0.5 shadow-md pot-slot relative`;
  const targetableClasses = isTargetable ? 'targetable ring-2 ring-amber-500 ring-offset-2' : '';

  return (
    <div className={`${potBaseClasses} ${targetableClasses}`} onClick={onClick}>
      {pot.card ? (
        <CardView card={pot.card} className="w-full h-full shadow-none border-none" />
      ) : (
        <span className="text-yellow-800 text-[10px] sm:text-xs">Empty Pot</span>
      )}
      {pot.card && pot.card.type === CardType.PLANT && (
        <div className="absolute bottom-0.5 right-0.5 bg-green-600 text-white text-[8px] sm:text-[9px] md:text-[10px] px-1 py-0.5 rounded">
          {(pot.card as PlantCard).plants} pts
        </div>
      )}
      {pot.card && pot.card.type === CardType.POWER && (pot.card as PowerCard).name === PowerCardName.DANDELION && (
         <div className="absolute bottom-0.5 right-0.5 bg-yellow-500 text-black text-[8px] sm:text-[9px] md:text-[10px] px-1 py-0.5 rounded">
          0 pts
        </div>
      )}
    </div>
  );
};

export default PotView;
