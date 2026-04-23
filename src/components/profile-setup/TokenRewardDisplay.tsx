'use client';
import React, { useState, useEffect } from 'react';

interface TokenRewardDisplayProps {
  finalAmount: number;
  duration?: number;
}

export default function TokenRewardDisplay({ finalAmount, duration = 1500 }: TokenRewardDisplayProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * finalAmount));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [finalAmount, duration]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className="text-6xl font-black text-brand-accent glow-pulse tracking-tighter">
          +{count}
        </div>
        <div className="absolute -inset-4 bg-brand-accent/5 blur-2xl rounded-full -z-10" />
      </div>
      <div className="text-xl font-bold text-foreground uppercase tracking-widest mt-2 animate-in fade-in duration-1000 delay-500">
        Tokens Credited
      </div>
      <p className="text-[11px] text-brand-secondary font-bold uppercase tracking-[0.15em] opacity-60">
        Deal Intelligence Onboarding Bonus
      </p>
    </div>
  );
}
