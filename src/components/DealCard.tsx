'use client';
import React from 'react';

interface DealCardProps {
  title: string;
  description: string;
}

export default function DealCard({ title, description }: DealCardProps) {
  return (
    <div className="flex-1 bg-white border border-[#E5E7EB] rounded-lg p-4 shadow-sm hover:border-[#F97316]/20 transition-all">
      <h3 className="text-[15px] font-bold text-[#1F2937] mb-1">{title}</h3>
      <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
