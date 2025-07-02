import React, { useEffect, useRef } from 'react';

interface GameLogProps {
  logs: string[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="mt-4 p-3 bg-gray-800 text-white rounded-lg shadow-inner h-40 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-2 text-gray-300">Game Log</h3>
      {logs.length === 0 && <p className="text-gray-400 italic">No actions yet...</p>}
      {logs.map((log, index) => (
        <p key={index} className="text-sm text-gray-300 mb-1 leading-tight">&raquo; {log}</p>
      ))}
    </div>
  );
};

export default GameLog;