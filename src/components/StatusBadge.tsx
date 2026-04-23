import React from 'react';

export type DealStatus = 'Searching Match' | 'Matched' | 'EOI Received' | 'EOI Sent' | 'Approved';

interface StatusBadgeProps {
  status: DealStatus;
}

const statusColors: Record<DealStatus, { bg: string, text: string }> = {
  'Searching Match': { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]' },
  'Matched': { bg: 'bg-green-100', text: 'text-green-600' },
  'EOI Received': { bg: 'bg-blue-50', text: 'text-blue-500' },
  'EOI Sent': { bg: 'bg-blue-50', text: 'text-blue-500' },
  'Approved': { bg: 'bg-green-500 text-white', text: '' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusColors[status] || statusColors['Searching Match'];

  return (
    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold ${config.bg} ${config.text} whitespace-nowrap`}>
      {status}
    </span>
  );
}
