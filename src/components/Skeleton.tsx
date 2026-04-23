'use client';
import React from 'react';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gray-100 rounded-md ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </div>
  );
}

export default Skeleton;

export function NotificationSkeleton() {
  return (
    <div className="space-y-3 p-5 bg-white/80 backdrop-blur-sm rounded-[24px] border border-gray-100/50 shadow-sm">
      <Skeleton className="h-4 w-1/4 rounded-full" />
      <Skeleton className="h-12 w-full rounded-2xl" />
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-5 p-6 bg-white/50 rounded-[32px]">
      <div className="flex gap-4">
        <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
        <Skeleton className="h-24 w-3/4 rounded-[24px]" />
      </div>
      <div className="flex gap-4 justify-end">
        <Skeleton className="h-16 w-1/2 rounded-[24px]" />
        <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
      </div>
    </div>
  );
}

export function DealLogSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 bg-white/80 backdrop-blur-sm rounded-[28px] border border-gray-100/30 flex justify-between items-center shadow-sm">
          <div className="space-y-2.5 w-3/5">
            <Skeleton className="h-5 w-4/5 rounded-full" />
            <Skeleton className="h-3.5 w-2/5 rounded-full" />
          </div>
          <Skeleton className="h-11 w-32 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <Skeleton className="h-36 rounded-[32px]" />
      <Skeleton className="h-36 rounded-[32px]" />
      <Skeleton className="h-36 rounded-[32px]" />
      <div className="md:col-span-2">
        <Skeleton className="h-72 rounded-[40px]" />
      </div>
      <Skeleton className="h-72 rounded-[40px]" />
    </div>
  );
}

export function DealDetailSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-56 rounded-[40px]" />
      <div className="grid grid-cols-3 gap-5">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-[40px]" />
    </div>
  );
}

export function EmptyState({ 
  title, 
  description, 
  actionLabel, 
  onAction, 
  icon 
}: { 
  title: string; 
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-4 bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-200 animate-in fade-in zoom-in duration-500">
      <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-gray-100 mb-2">
         {icon || <div className="text-2xl">🔍</div>}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-black text-[#1F2937] tracking-tight">{title}</h3>
        <p className="text-sm text-gray-500 max-w-xs mx-auto font-medium leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="mt-4 bg-[#F97316] text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-[#EA580C] transition-all active:scale-95 shadow-lg shadow-[#F97316]/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="p-10 bg-red-50/30 backdrop-blur-sm rounded-[40px] border border-red-100 text-center space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex justify-center text-red-500 text-3xl">⚠️</div>
      <div className="space-y-1">
        <p className="text-sm font-black text-red-900 tracking-tight">{message || 'Something went wrong.'}</p>
        <p className="text-xs text-red-600/70 font-medium tracking-wide">Please check your intelligence connection or try again.</p>
      </div>
      {onRetry && (
        <button 
          onClick={() => onRetry()}
          className="bg-white border border-red-200 text-red-600 px-8 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
