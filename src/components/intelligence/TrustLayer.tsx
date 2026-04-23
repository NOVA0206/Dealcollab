'use client';
import React from 'react';

export default function TrustLayer() {
  return (
    <section className="relative z-30 py-32 border-t border-white/5 mx-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left">
        <div className="space-y-2 max-w-sm">
          <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">Foundation</p>
          <p className="text-white font-medium text-lg leading-snug">
            Built for institutional-grade decision environments
          </p>
        </div>
        
        <div className="hidden md:block w-[1px] h-12 bg-white/5" />
        
        <div className="space-y-2 max-w-sm">
          <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">Performance</p>
          <p className="text-white font-medium text-lg leading-snug">
            Used where timing defines outcomes
          </p>
        </div>

        <div className="hidden md:block w-[1px] h-12 bg-white/5" />
        
        <div className="space-y-2 max-w-sm">
          <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">Integrity</p>
          <p className="text-white font-medium text-lg leading-snug">
            Exclusive intelligence layer for senior operators
          </p>
        </div>
      </div>
      
      <div className="pt-24 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10">
          DealCollab AI &copy; 2026 Sovereign Data Intelligence
        </p>
      </div>
    </section>
  );
}
