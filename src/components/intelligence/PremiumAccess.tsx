'use client';
import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function PremiumAccess() {
  return (
    <section className="relative z-30 py-32 px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#0B0F1A] border border-white/5 rounded-[48px] p-16 md:p-24 text-center space-y-12 shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Subtle Silver Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent opacity-50" />
          
          <div className="relative z-10 flex flex-col items-center space-y-8">
            <div className="bg-white/5 p-4 rounded-full border border-white/10 text-white/40">
              <ShieldCheck size={40} strokeWidth={1} />
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                Basic users see information. <br />
                <span className="text-white/40">Serious players see intelligence.</span>
              </h2>
            </div>
            
            <div className="pt-6">
              <button className="px-12 py-5 bg-white text-[#0B0F1A] rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all hover:bg-gray-200 hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                Apply for Access
              </button>
            </div>
          </div>
          
          {/* Muted Decorative Corner (Muted Gold theme) */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-yellow-500/10 to-transparent blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-500/10 to-transparent blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
        </div>
      </div>
    </section>
  );
}
