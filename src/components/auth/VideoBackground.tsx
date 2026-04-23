'use client';
import React from 'react';

export default function VideoBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Immersive Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        src="/earth.mp4"
        poster="/earth-poster.png"
        className="fixed inset-0 w-full h-full object-cover opacity-100 scale-100 animate-[zoom-slow_30s_infinite_alternate]"
      />

      {/* Premium Visual Overlays */}
      <div className="fixed inset-0 bg-black/70 z-10 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-tr from-black via-transparent to-black/30 z-11 opacity-80 pointer-events-none" />
      
      {/* Technical Blur for Text Clarity */}
      <div className="fixed inset-0 backdrop-blur-[2px] z-12 pointer-events-none" />
    </div>
  );
}
