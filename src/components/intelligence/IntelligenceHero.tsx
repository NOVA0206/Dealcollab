'use client';
import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function IntelligenceHero() {
  return (
    <section className="relative w-full pt-32 pb-20 px-6 sm:px-10 overflow-hidden">
      {/* Subtle Depth Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] -mt-64 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#C9A74D]/5 rounded-full blur-[120px] -mt-32 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="space-y-12 text-left">
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-1000">
             <div className="w-1.5 h-1.5 bg-[#C9A74D] rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#9CA3AF]">Sector-Gated Intelligence Layer</span>
          </div>

          <div className="space-y-6 max-w-4xl">
             <h1 className="text-[40px] sm:text-[64px] font-bold text-[#F9FAFB] leading-[1] tracking-tight animate-in fade-in slide-in-from-left-8 duration-1000 delay-100">
                Know the Market <br/> 
                <span className="text-[#9CA3AF]">Before the Market Knows It.</span>
             </h1>
             <p className="text-lg sm:text-xl font-medium text-[#6B7280] leading-relaxed max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                Institutional-grade deal intelligence derived from live market flow, 
                behavioral demand signals, and verified counterparty behavior.
             </p>
          </div>

          <div className="pt-8 animate-in fade-in duration-1000 delay-500">
             <button className="px-10 py-5 bg-[#C9A74D] hover:bg-[#B3923F] text-[#020617] rounded-xl font-black text-xs uppercase tracking-[0.3em] transition-all duration-300 shadow-2xl shadow-[#C9A74D]/10 hover:-translate-y-1">
                Unlock Full Intelligence Report
             </button>
          </div>
        </div>
      </div>
    </section>
  );
}
