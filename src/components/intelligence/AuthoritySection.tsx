'use client';
import React from 'react';

export default function AuthoritySection() {
  const statements = [
    "Built from live deal flow",
    "Powered by real market signals",
    "Used by institutional participants",
  ];

  return (
    <section className="max-w-7xl mx-auto w-full px-6 sm:px-10 py-24 border-t border-white/5 mt-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-12 opacity-40 hover:opacity-100 transition-opacity duration-1000">
        {statements.map((statement, idx) => (
           <div key={idx} className="flex items-center gap-4 text-center md:text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#6B7280]">
                 {statement}
              </div>
              {idx < statements.length - 1 && (
                 <div className="hidden md:block w-px h-4 bg-white/10" />
              )}
           </div>
        ))}
      </div>
    </section>
  );
}
