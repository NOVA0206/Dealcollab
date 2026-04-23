'use client';
import React from 'react';
import StatusBadge, { DealStatus } from './StatusBadge';
import ThreeDotMenu from './ThreeDotMenu';

export interface Deal {
  id: number;
  name: string;
  status: DealStatus;
}

interface DealRowProps {
  deal: Deal;
  onDelete: () => void;
}

export default function DealRow({ deal, onDelete }: DealRowProps) {
  return (
    <div className="grid grid-cols-12 items-center p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg hover:bg-gray-50 transition-all gap-4 mb-3">
      {/* Proposed Deals (Name) */}
      <div className="col-span-6 sm:col-span-8">
        <span className="text-[15px] font-semibold text-[#1F2937]">
          {deal.name}
        </span>
      </div>

      {/* Status Badge */}
      <div className="col-span-4 sm:col-span-3 flex justify-center">
        <StatusBadge status={deal.status} />
      </div>

      {/* Actions */}
      <div className="col-span-2 sm:col-span-1 flex justify-end">
        <ThreeDotMenu onDelete={onDelete} />
      </div>
    </div>
  );
}
