'use client';
import React from 'react';
import { Construction, Clock } from 'lucide-react';

interface FeatureLockedOverlayProps {
  title?: string;
  subtitle?: string;
}

export default function FeatureLockedOverlay({ 
  title = "Our team is working on it", 
  subtitle = "It will be accessible soon" 
}: FeatureLockedOverlayProps) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-6 animate-in fade-in duration-700">
      {/* Backdrop with Blur and Darkening */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md" />

      {/* Message Card */}
      <div className="relative z-10 max-w-md w-full bg-white rounded-[40px] p-10 shadow-[0_32px_80px_rgba(0,0,0,0.3)] border border-white/20 text-center space-y-8 animate-in zoom-in slide-in-from-bottom-8 duration-1000 ease-out">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-brand-accent/20 blur-2xl rounded-full animate-pulse" />
            <div className="relative w-20 h-20 bg-brand-accent text-white rounded-3xl flex items-center justify-center shadow-xl shadow-brand-accent/30 transform rotate-3">
              <Construction size={40} strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight">
            {title}
          </h2>
          <p className="text-brand-secondary text-base font-medium opacity-80 flex items-center justify-center gap-2">
            <Clock size={16} className="text-brand-accent" />
            {subtitle}
          </p>
        </div>

        <div className="pt-4 flex justify-center">
          <div className="px-6 py-2 bg-gray-50 rounded-full border border-gray-100 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-secondary">Feature in Development</span>
          </div>
        </div>
      </div>
    </div>
  );
}
