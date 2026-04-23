'use client';
import React from 'react';

export default function VideoLogo() {
  return (
    <div className="relative group">
      {/* Container with premium border/glow */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[20px] sm:rounded-[24px] overflow-hidden relative z-10 shadow-xl shadow-black/20 border border-white/10 group-hover:scale-105 transition-transform duration-500 bg-black">
        <video
          autoPlay
          loop
          muted
          playsInline
          src="/earth.mp4"
          className="w-full h-full object-cover scale-110"
        />
        
        {/* Subtle Inner Glow */}
        <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/20 pointer-events-none" />
      </div>

      {/* Outer subtle glow */}
      <div className="absolute inset-0 bg-[#F97316]/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10" />
    </div>
  );
}
