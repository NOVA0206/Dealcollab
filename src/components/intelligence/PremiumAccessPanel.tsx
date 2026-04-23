'use client';
import React from 'react';
import { Lock, Sparkles, ChevronRight } from 'lucide-react';

export default function PremiumAccessPanel() {
  return (
    <section className="max-w-7xl mx-auto w-full px-6 sm:px-10 py-12">
      <div className="relative bg-[#0B1220] border border-white/5 rounded-[48px] p-12 sm:p-20 text-center space-y-10 overflow-hidden group">
        
        {/* Mysterious Ambient Background */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#C9A74D]/5 rounded-full blur-[120px] -mr-32 -mt-32 opacity-50 transition-opacity group-hover:opacity-100 duration-1000" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] -ml-32 -mb-32 opacity-50" />

        <div className="relative z-10 flex flex-col items-center gap-8">
           <div className="w-20 h-20 bg-[#111827] rounded-[32px] flex items-center justify-center text-[#C9A74D] border border-white/5 shadow-2xl relative">
              <Lock size={32} strokeWidth={1.5} />
              <div className="absolute -top-1.5 -right-1.5 p-1 bg-[#C9A74D] rounded-full text-[#020617] animate-pulse">
                 <Sparkles size={12} />
              </div>
           </div>

           <div className="space-y-4 max-w-2xl mx-auto">
              <h3 className="text-3xl sm:text-4xl font-bold text-[#F9FAFB] tracking-tight leading-tight">Access Institutional Intelligence</h3>
              <p className="text-base sm:text-lg font-medium text-[#6B7280] leading-relaxed">
                 Basic users see information. <span className="text-[#F9FAFB]">Serious players see intelligence.</span> <br/>
                 Gain absolute visibility into the private markets.
              </p>
           </div>
           
           <div className="pt-6 w-full max-w-xs mx-auto">
              <button className="w-full py-5 bg-[#C9A74D] hover:bg-[#B3923F] text-[#020617] rounded-2xl font-black text-xs uppercase tracking-[0.4em] transition-all duration-300 shadow-2xl shadow-[#C9A74D]/20 hover:-translate-y-1 flex items-center justify-center gap-3">
                 Unlock Full Access <ChevronRight size={18} />
              </button>
           </div>

           <div className="pt-4 flex items-center gap-3 opacity-30 group-hover:opacity-60 transition-opacity">
              <div className="flex -space-x-3">
                 {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border border-[#0B1220] bg-gray-600 grayscale" />
                 ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Invited Participants Only</p>
           </div>
        </div>
      </div>
    </section>
  );
}
