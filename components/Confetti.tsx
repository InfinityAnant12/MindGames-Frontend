import React, { useEffect, useState } from 'react';

interface ConfettiProps {
  isActive: boolean;
  particleCount?: number;
}

const Confetti: React.FC<ConfettiProps> = ({ isActive, particleCount = 150 }) => {
  console.log('[Confetti Component] Render. isActive:', isActive); // Log render
  const [particles, setParticles] = useState<JSX.Element[]>([]);

  useEffect(() => {
    console.log('[Confetti useEffect] Running. isActive:', isActive); // Log effect run
    if (isActive) {
      const newParticles = Array.from({ length: particleCount }).map((_, index) => {
        const style: React.CSSProperties = {
          position: 'fixed',
          width: `${Math.random() * 8 + 6}px`, // Random width between 6-14px
          height: `${Math.random() * 12 + 8}px`, // Random height between 8-20px
          backgroundColor: getRandomColor(),
          top: `${Math.random() * -50 - 10}vh`, // Start above the screen
          left: `${Math.random() * 100}vw`, // Random horizontal position
          opacity: 1,
          animationName: 'confetti-fall, confetti-sway, confetti-rotate',
          animationDuration: `${Math.random() * 3 + 4}s, ${Math.random() * 2 + 1.5}s, ${Math.random() * 2 + 2}s`, // Fall, Sway, Rotate durations
          animationDelay: `${Math.random() * 3}s`, // Stagger start times
          animationTimingFunction: 'linear, ease-in-out, linear',
          animationIterationCount: '1, infinite, infinite', // Fall once, sway and rotate infinitely (until fall ends opacity)
          animationFillMode: 'forwards',
          zIndex: 1000,
          transformOrigin: 'center center',
        };
        // Simple shapes (rectangles for now)
        if (Math.random() > 0.7) { // Some squares
            style.width = style.height;
        }

        return <div key={index} style={style} className="confetti-particle" />;
      });
      setParticles(newParticles);
      console.log(`[Confetti useEffect] ${newParticles.length} particles created and set.`); // Log particle creation
    } else {
      setParticles([]);
      console.log('[Confetti useEffect] isActive is false. Particles cleared.'); // Log clearing
    }
  }, [isActive, particleCount]);

  const getRandomColor = () => {
    const colors = ['#4ade80', '#2dd4bf', '#facc15', '#a855f7', '#34d399', '#fde047']; // Greens, teal, yellow, purple
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return <>{particles}</>;
};

export default Confetti;