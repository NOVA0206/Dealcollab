'use client';
import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { useUser } from './UserProvider';

export default function GlobalErrorBanner() {
  const { globalError, setGlobalError } = useUser();

  if (!globalError) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-500">
      <div className="bg-[#1F2937] text-white px-6 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.2)] border-b border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/20 p-1.5 rounded-lg">
            <AlertCircle size={18} className="text-red-400" />
          </div>
          <p className="text-sm font-bold tracking-tight">
            {globalError}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <RefreshCw size={12} />
            Refresh Page
          </button>
          
          <button 
            onClick={() => setGlobalError(null)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
