'use client';
import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative z-30 pt-24 pb-10 px-8 flex flex-col items-center text-center max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="space-y-4">
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl">
          Know the Market <br /> Before the Market Knows It
        </h1>
        <p className="text-xl md:text-2xl text-white/50 font-medium max-w-2xl mx-auto leading-relaxed">
          Private intelligence for those who operate ahead of the deal cycle
        </p>
      </div>

      <div className="pt-6">
        <button className="group relative flex items-center gap-3 px-10 py-5 bg-white text-[#0B0F1A] rounded-2xl font-bold text-lg transition-all hover:bg-gray-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(255,255,255,0.1)]">
          Request Access to Intelligence Layer
          <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          
          {/* Subtle Glow */}
          <div className="absolute inset-0 rounded-2xl bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
        </button>
      </div>
    </section>
  );
}
