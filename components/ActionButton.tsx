import React from 'react';

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, disabled = false, children, className = '', variant = 'primary' }) => {
  let baseStyle = 'px-4 py-2 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150';
  
  if (disabled) {
    baseStyle += ' bg-gray-400 text-gray-600 cursor-not-allowed';
  } else {
    switch (variant) {
      case 'primary':
        baseStyle += ' bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-400';
        break;
      case 'secondary':
        baseStyle += ' bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-400';
        break;
      case 'danger':
        baseStyle += ' bg-red-500 hover:bg-red-600 text-white focus:ring-red-400';
        break;
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${className}`}
    >
      {children}
    </button>
  );
};

export default ActionButton;