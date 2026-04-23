'use client';
import React from 'react';

interface StepCardProps {
  title: string;
  helper?: string;
  children: React.ReactNode;
}

export default function StepCard({ title, helper, children }: StepCardProps) {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-1.5 px-2">
        <h2 className="text-2xl font-black text-foreground tracking-tight">{title}</h2>
        {helper && (
          <p className="text-brand-secondary text-sm font-medium opacity-80">{helper}</p>
        )}
      </div>
      <div className="bg-white rounded-[32px] border border-brand-border p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
        {children}
      </div>
    </div>
  );
}
