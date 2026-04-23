'use client';
import React from 'react';

export default function IntelligenceStrip() {
  const signals = [
    "Deal Flow Signals Active",
    "Buyer Intent Rising",
    "Network Activity Increasing",
    "Private Equity Dry Powder +12%",
    "Cross-Border Interest Surging"
  ];

  return (
    <div className="relative z-30 w-full overflow-hidden py-8 border-y border-white/5 bg-white/[0.02] backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-x-12 gap-y-4">
          {signals.map((signal, index) => (
            <React.Fragment key={index}>
              <div className="flex items-center gap-3">
                <span className="w-1 h-1 bg-white/20 rounded-full shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">
                  {signal}
                </span>
              </div>
              {index < signals.length - 1 && (
                <div className="hidden md:block h-4 w-[1px] bg-white/5" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
