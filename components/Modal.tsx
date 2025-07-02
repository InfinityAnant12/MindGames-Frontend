import React from 'react';
import ActionButton from './ActionButton';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeButtonText?: string;
}

const Modal: React.FC<ModalProps> = ({ title, isOpen, onClose, children, showCloseButton = true, closeButtonText = "Close" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full text-center">
        <h2 className="text-3xl font-bold mb-4 text-emerald-700">{title}</h2>
        <div className="text-gray-700 mb-6">
          {children}
        </div>
        {showCloseButton && onClose && (
          <ActionButton onClick={onClose} variant="primary" className="w-1/2 mx-auto">
            {closeButtonText}
          </ActionButton>
        )}
      </div>
    </div>
  );
};

export default Modal;