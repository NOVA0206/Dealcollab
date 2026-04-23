'use client';
import React from 'react';
import { Mail, Phone, MessageSquare, CheckCircle2, XCircle, FileText, User, Zap, Info } from 'lucide-react';

interface IncomingEOIDetailsProps {
  item: {
    deal: string;
    dealDesc: string;
    match: string;
    matchDesc: string;
  };
  onApprove: () => void;
  onDecline: () => void;
}

export default function IncomingEOIDetails({ item, onApprove, onDecline }: IncomingEOIDetailsProps) {
  // Mock EOI data (as if received)
  const eoiData = {
    intent: "Invest / Acquire",
    background: "Managing Partner at a mid-market private equity fund specializing in logistics and supply chain optimization. Successfully exited 3 similar platforms in the last 5 years.",
    interest: "Your regional last-mile network perfectly complements our existing portfolio company's line-haul operations. We see significant synergy in combining these assets.",
    capacity: "$5M - $12M",
    strength: "High"
  };

  return (
    <div className="bg-white border-t border-[#E5E7EB] p-6 sm:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Left: Engagement Profile */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#F97316]" />
              <h4 className="text-xs font-black uppercase tracking-widest text-[#1F2937]">Proposed Engagement</h4>
            </div>
            <div className="bg-[#F97316]/10 text-[#F97316] text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
               {eoiData.strength} Alignment
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 space-y-6">
             <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Intent</p>
                  <p className="text-sm font-bold text-[#1F2937]">{eoiData.intent}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Scale / Capacity</p>
                  <p className="text-sm font-bold text-[#1F2937]">{eoiData.capacity}</p>
                </div>
             </div>
             
             <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Background</p>
                <p className="text-xs text-[#6B7280] leading-relaxed font-medium">{eoiData.background}</p>
             </div>

             <div className="pt-4 border-t border-gray-200">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Strategic Interest</p>
                <p className="text-xs text-[#1F2937] leading-relaxed font-bold italic">"{eoiData.interest}"</p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[#F97316]">
                    <Zap size={10} /> AI Note: Strategically aligned with your exit timeframe.
                </div>
             </div>
          </div>
        </div>

        {/* Right: Security & Actions */}
        <div className="flex flex-col justify-between">
           <div className="space-y-6">
              <div className="flex items-center gap-2">
                 <User size={16} className="text-[#F97316]" />
                 <h4 className="text-xs font-black uppercase tracking-widest text-[#1F2937]">Identity Status</h4>
              </div>
              
              <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                 <div className="flex items-start gap-4 mb-4">
                    <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 font-medium leading-relaxed">
                       The sender's name and contact details (Sarah Jenkins) are currently **hidden**. By clicking "Approve", you will unlock mutual identity and access direct communication channels.
                    </p>
                 </div>
                 <div className="grid grid-cols-2 gap-3 opacity-40 grayscale pointer-events-none select-none">
                    <div className="h-8 bg-white/50 rounded-lg"></div>
                    <div className="h-8 bg-white/50 rounded-lg"></div>
                 </div>
              </div>
           </div>

           <div className="mt-10 sm:mt-0 pt-10 border-t border-gray-100 flex flex-col gap-3">
              <button 
                onClick={onApprove}
                className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all active:scale-95"
              >
                 <CheckCircle2 size={18} /> Approve — Unlock Contact
              </button>
              <button 
                onClick={onDecline}
                className="w-full py-4 bg-white text-[#6B7280] border border-[#E5E7EB] rounded-xl text-sm font-black uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95"
              >
                 Decline Interest
              </button>
              <p className="text-[10px] text-[#9CA3AF] text-center font-medium">No tokens required to approve incoming EOIs.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
