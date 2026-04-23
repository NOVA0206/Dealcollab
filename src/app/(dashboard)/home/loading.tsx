import React from 'react';
import { Skeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col w-full h-full relative p-6 sm:p-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-10 border-b border-gray-100 pb-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="w-48 h-10" />
          <Skeleton className="w-64 h-4" />
        </div>
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>

      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="w-full h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
