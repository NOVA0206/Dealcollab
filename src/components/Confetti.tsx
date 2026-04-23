'use client';
import React, { useEffect, useState } from 'react';

export default function Confetti() {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const colors = ['#F97316', '#1F2937', '#22C55E', '#3B82F6'];
    const newParticles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + '%',
      top: -20 + 'px',
      size: Math.random() * 8 + 4 + 'px',
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 1.5 + 's',
      duration: Math.random() * 1.5 + 1 + 's',
      rotation: Math.random() * 360 + 'deg'
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm animate-fall"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: 0.8,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotation})`
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0); opacity: 0.8; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-fall {
          animation: fall linear forwards;
        }
      `}</style>
    </div>
  );
}
