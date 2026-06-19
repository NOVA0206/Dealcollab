'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import DashboardRow, { DashboardDeal } from '@/components/DashboardRow';
import { DashboardStatus } from '@/components/StatusButton';
import { DashboardSkeleton, EmptyState, ErrorState } from '@/components/Skeleton';
import SendEOIModal, { EOIFormData } from '@/components/SendEOIModal';
import { LayoutGrid, PlusCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface EOIResponse {
  id: string | number;
  status: string;
  deal?: { title?: string; sector?: string; size?: string };
  sender?: { name?: string; role?: string; firm_name?: string };
  receiver?: { name?: string; role?: string; firm_name?: string };
}

export default function DealDashboardPage() {
  const { data: inboundData, error: inboundError, mutate: mutateInbound, isValidating: inboundVal } = useSWR('/api/eois?type=inbound', fetcher, { refreshInterval: 15000 });
  const { data: outboundData, error: outboundError, mutate: mutateOutbound, isValidating: outboundVal } = useSWR('/api/eois?type=outbound', fetcher, { refreshInterval: 15000 });

  const loading = !inboundData && !inboundError;
  const refreshing = (inboundVal && !!inboundData) || (outboundVal && !!outboundData);
  const error = inboundError || outboundError;

  const [eoiModal, setEoiModal] = useState<{isOpen: boolean, deal: DashboardDeal | null}>({
    isOpen: false,
    deal: null
  });

  // Map API eois to UI components
  const formatEoi = (eoi: EOIResponse, isIncoming: boolean): DashboardDeal => {
     let mappedStatus = eoi.status;
     if (isIncoming && eoi.status === 'sent') mappedStatus = 'EOI Received';
     if (!isIncoming && eoi.status === 'sent') mappedStatus = 'EOI Sent — Awaiting Approval';
     if (eoi.status === 'approved') mappedStatus = 'Approved';
     if (eoi.status === 'declined') mappedStatus = 'Declined';

     const role = isIncoming ? eoi.sender?.role : eoi.receiver?.role;
     const firmName = isIncoming ? eoi.sender?.firm_name : eoi.receiver?.firm_name;
     let matchDesc = role || '';
     if (firmName) {
       matchDesc = matchDesc ? `${matchDesc} at ${firmName}` : firmName;
     }

     return {
       id: eoi.id,
       deal: eoi.deal?.title || "Active Deal",
       dealDesc: `Sector: ${eoi.deal?.sector || 'N/A'}, Size: ${eoi.deal?.size || 'N/A'}`,
       match: isIncoming ? eoi.sender?.name || '' : eoi.receiver?.name || '',
       matchDesc,
       status: mappedStatus as DashboardStatus,
       isIncoming,
       raw: eoi
     }
  };

  const incomingEOIs: DashboardDeal[] = (inboundData || []).map((e: EOIResponse) => formatEoi(e, true));
  const myProposals: DashboardDeal[] = (outboundData || []).map((e: EOIResponse) => formatEoi(e, false));
  const data = [...incomingEOIs, ...myProposals];

  const handleApproveEOI = async (eoiId: string | number) => {
    try {
      const res = await fetch('/api/eois', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eoiId, status: 'approved' })
      });
      if (!res.ok) throw new Error('Failed to approve EOI');
      mutateInbound();
      mutateOutbound();
    } catch (err: unknown) {
      console.error('🔥 handleApproveEOI failed:', err);
    }
  };

  const handleDeclineEOI = async (eoiId: string | number) => {
    try {
      const res = await fetch('/api/eois', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eoiId, status: 'declined' })
      });
      if (!res.ok) throw new Error('Failed to decline EOI');
      mutateInbound();
      mutateOutbound();
    } catch (err: unknown) {
      console.error('🔥 handleDeclineEOI failed:', err);
    }
  };

  const handleRemoveEOI = async (eoiId: string | number) => {
    if (!confirm('Are you sure you want to remove this match? This will delete it permanently.')) return;
    try {
      const res = await fetch(`/api/eois?id=${eoiId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove EOI');
      mutateInbound();
      mutateOutbound();
    } catch (err: unknown) {
      console.error('🔥 handleRemoveEOI failed:', err);
    }
  };

  const handleEOIRequest = (item: DashboardDeal) => {
    setEoiModal({ isOpen: true, deal: item });
  };

  const handleEOISubmit = async (_data: EOIFormData) => {
    setEoiModal({ isOpen: false, deal: null });
    mutateOutbound();
    mutateInbound();
  };

  return (
    <div className="relative flex-1 flex flex-col w-full bg-white h-full">
      <div className="flex-1 flex flex-col w-full p-6 sm:p-10 transition-all duration-700 relative overflow-y-auto">
      
      {/* Top Bar Section */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <h1 className="text-3xl font-bold text-[#1F2937] tracking-tight">Deal Dashboard</h1>
             <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-100 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Live</span>
             </div>
             {refreshing && (
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full animate-in fade-in slide-in-from-left-2 transition-all">
                   <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Updating...</span>
                </div>
             )}
          </div>
          <p className="text-gray-500 text-sm font-medium">Intelligent matchmaking and engagement tracking</p>
        </div>
        
        {data.length > 0 && (
          <button className="flex items-center gap-2 bg-[#1F2937] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#F97316] transition-all shadow-sm">
             <PlusCircle size={18} />
             Create Deal
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full">
        
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorState onRetry={() => { mutateInbound(); mutateOutbound(); }} />
        ) : data.length === 0 ? (
          <EmptyState 
            title="No matches found yet" 
            description="Our Intelligence Layer is scanning for opportunities. Create a new deal to accelerate the process."
            actionLabel="Create Deal"
            onAction={() => {}}
            icon={<LayoutGrid size={32} />}
          />
        ) : (
          <div className="space-y-12">
            {/* Incoming Section */}
            {incomingEOIs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2 h-2 bg-[#F97316] rounded-full animate-pulse" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#1F2937]">Incoming Proposals ({incomingEOIs.length})</h2>
                </div>
                <div className="flex flex-col gap-6">
                  {incomingEOIs.map(item => (
                    <DashboardRow 
                      key={item.id} 
                      item={item} 
                      onEOIClick={() => handleEOIRequest(item)}
                      onApprove={() => handleApproveEOI(item.id)}
                      onDecline={() => handleDeclineEOI(item.id)}
                      onRemove={() => handleRemoveEOI(item.id)}
                    />
                  ))}
                </div>
              </div>
            )}
 
            {/* My Proposals Section */}
            <div className="space-y-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#6B7280] px-1">My Proposals ({myProposals.length})</h2>
              <div className="flex flex-col gap-6">
                {myProposals.map(item => (
                  <DashboardRow 
                    key={item.id} 
                    item={item} 
                    onEOIClick={() => handleEOIRequest(item)}
                    onApprove={() => handleApproveEOI(item.id)}
                    onDecline={() => handleDeclineEOI(item.id)}
                    onRemove={() => handleRemoveEOI(item.id)}
                  />
                ))}
              </div>
            </div>

            {/* View More Button */}
            <div className="mt-12 flex justify-center pb-20">
              <Link 
                href="/deal-log"
                className="w-full py-4 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-2xl text-gray-400 text-sm font-bold hover:bg-gray-100 hover:text-[#1F2937] transition-all duration-300"
              >
                View More Active Deals
              </Link>
            </div>
          </div>
        )}
      </div>

      <SendEOIModal
        isOpen={eoiModal.isOpen}
        onClose={() => setEoiModal({ isOpen: false, deal: null })}
        dealName={eoiModal.deal?.deal || ''}
        onSubmit={handleEOISubmit}
      />
    </div>
    </div>
  );
}
