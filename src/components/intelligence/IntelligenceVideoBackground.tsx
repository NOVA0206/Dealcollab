'use client';
import React from 'react';

export default function IntelligenceVideoBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#0B0F1A]">
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/70 z-10" />
      
      {/* Video Layer */}
      <video
        autoPlay
        loop
        muted
        playsInline
        src="/earth.mp4"
        poster="/earth-poster.png"
        className="absolute inset-0 w-full h-full object-cover opacity-20 blur-[2px] transition-transform duration-[20s] animate-[zoom-slow_20s_infinite_alternate]"
      />
      
      {/* Gradients to add even more depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0B0F1A]/50 to-[#0B0F1A] z-20" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#0B0F1A] to-transparent z-20" />
    </div>
  );
}
