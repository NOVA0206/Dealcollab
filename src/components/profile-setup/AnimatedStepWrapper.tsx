'use client';
import React from 'react';

interface AnimatedStepWrapperProps {
  children: React.ReactNode;
  direction: 'next' | 'back';
  isActive: boolean;
}

export default function AnimatedStepWrapper({ children, direction, isActive }: AnimatedStepWrapperProps) {
  if (!isActive) return null;

  return (
    <div className={`w-full animate-in fade-in duration-500 fill-mode-both ${
      direction === 'next' 
        ? 'slide-in-from-right-8' 
        : 'slide-in-from-left-8'
    }`}>
      {children}
    </div>
  );
}
