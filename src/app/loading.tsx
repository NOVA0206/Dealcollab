'use client';
import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="w-20 h-20 rounded-[24px]" />
          <div className="space-y-2 flex flex-col items-center w-full">
            <Skeleton className="h-8 w-48 rounded-full" />
            <Skeleton className="h-4 w-64 rounded-full opacity-50" />
          </div>
        </div>
        
        <div className="bg-white/5 backdrop-blur-3xl rounded-[32px] p-8 border border-white/10 space-y-6">
          <div className="space-y-3">
             <Skeleton className="h-10 w-full rounded-2xl opacity-40" />
             <Skeleton className="h-4 w-3/4 rounded-full mx-auto opacity-20" />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
