'use client';
import React from 'react';

const modules = [
  {
    title: "Network Intelligence",
    description: "Real-time mapping of institutional relationships and decision nodes across the deal ecosystem."
  },
  {
    title: "Deal Flow Prediction",
    description: "Probabilistic modeling of upcoming capital events before they reach the public market."
  },
  {
    title: "Buyer Intent Intelligence",
    description: "Behavioral analysis of capital allocators to identify high-conviction acquisition interest."
  },
  {
    title: "Undersupplied Demand Zones",
    description: "Gap analysis identifying sectors where capital demand significantly outstrips active deal supply."
  },
  {
    title: "Deal Closure Probability",
    description: "Quantitative assessment of transaction success based on historical and situational variables."
  }
];

export default function IntelligenceModules() {
  return (
    <section className="relative z-30 py-32 px-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module, index) => (
          <div 
            key={index}
            className={`group relative p-8 bg-white/[0.03] border border-white/10 rounded-[32px] overflow-hidden transition-all duration-500 hover:bg-white/[0.05] hover:border-white/20 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${
              index > 2 ? 'lg:col-span-1.5' : ''
            }`}
          >
            {/* Subtle Gradient Glow on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10 space-y-6">
              <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-white transition-colors">
                {module.title}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                {module.description}
              </p>
              
              <div className="pt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-y-2 group-hover:translate-y-0">
                <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Exclusive Intelligence</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
