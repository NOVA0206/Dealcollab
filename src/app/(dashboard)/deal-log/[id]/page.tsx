'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, ShieldCheck, Target, Globe, 
  TrendingUp, Clock, Info, Coins, AlertCircle, 
  CheckCircle2, Sparkles, Building2, Layers
} from 'lucide-react';
import { useUser } from '@/components/UserProvider';
import { useNotifications } from '@/components/NotificationProvider';
import { Skeleton } from '@/components/Skeleton';

interface AnonymousMatch {
  id: string;
  type: string;
  structure: string;
  sectors: string[];
  geography: string;
  revenueRange: string;
  specialConditions: string;
  age: string;
  matchScore: number;
}

const mockMatchData: Record<string, AnonymousMatch> = {
  "p1": {
    id: "p1",
    type: "M&A / Acquisition",
    structure: "Cash + Earn-out (24 months)",
    sectors: ["Fintech", "Payments Architecture", "AI Infrastructure"],
    geography: "DACH Region (Germany, Austria, Switzerland)",
    revenueRange: "$5M - $12M ARR",
    specialConditions: "Founder retention required for 12 months. ISO 27001 certification preferred.",
    age: "4 days ago",
    matchScore: 94
  },
  "p2": {
    id: "p2",
    type: "Strategic Partnership",
    structure: "Joint Venture / Revenue Share",
    sectors: ["Enterprise SaaS", "Cloud Security"],
    geography: "North America (Remote First)",
    revenueRange: "Early Stage / Pre-revenue",
    specialConditions: "Intellectual property must be jointly owned. No exclusive lock-in.",
    age: "Today",
    matchScore: 88
  }
};

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tokens, approveEOI } = useUser();
  const { addNotification } = useNotifications();
  const id = params.id as string;
  
  const [match, setMatch] = useState<AnonymousMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    // Simulate API fetch
    const timer = setTimeout(() => {
      setMatch(mockMatchData[id] || mockMatchData["p1"]);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [id]);

  const handleSendEOI = () => {
    if ((tokens ?? 0) < 50) return;
    
    setIsSending(true);
    // Simulate process
    setTimeout(() => {
      approveEOI(parseInt(id.replace('p', '')) * 1000); // Trigger token deduction in mock
      addNotification({
        type: 'success',
        message: 'Expression of Interest sent successfully.',
        time: 'Just now'
      });
      setIsSending(false);
      router.push('/deal-dashboard');
    }, 1500);
  };

  if (loading) return (
    <div className="flex-1 p-10 max-w-4xl mx-auto w-full space-y-8 animate-pulse">
       <div className="w-48 h-8 bg-gray-100 rounded-xl" />
       <div className="w-full h-96 bg-gray-50 rounded-[40px]" />
    </div>
  );

  if (!match) return null;

  const hasTokens = (tokens ?? 0) >= 50;

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-[#F9FAFB] relative overflow-y-auto">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 sm:px-10 py-5 flex items-center gap-4">
         <button 
           onClick={() => router.back()}
           className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-[#1F2937]"
         >
           <ArrowLeft size={20} />
         </button>
         <h1 className="text-xl font-bold text-[#1F2937] tracking-tight">Match Details</h1>
         <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-orange-50 border border-orange-100 rounded-full">
            <span className="text-[10px] font-black text-[#F97316] uppercase tracking-widest">Confidential Match</span>
         </div>
      </div>

      <div className="p-6 sm:p-10 max-w-4xl mx-auto w-full space-y-8 pb-32">
        
        {/* PRIVACY SHIELD WARNING */}
        <div className="bg-[#1F2937] p-6 rounded-[32px] text-white flex items-center gap-5 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#F97316]/20 rounded-full -mr-16 -mt-16 blur-2xl" />
           <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck size={24} className="text-[#F97316]" />
           </div>
           <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#F97316] mb-1">Identity Encryption Active</p>
              <p className="text-sm font-medium text-gray-300">Names and contact details are hidden until your Expression of Interest is approved by the counterparty.</p>
           </div>
        </div>

        {/* MATCH DETAIL CARD */}
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-700">
           
           <div className="p-8 sm:p-10 space-y-10">
              
              {/* Match Score Indicator */}
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-50 rounded-[20px] flex items-center justify-center text-[#F97316]">
                       <Sparkles size={24} />
                    </div>
                    <div>
                       <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6B7280]">Intelligence Match Score</p>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black text-[#1F2937]">{match.matchScore}%</span>
                          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                             <div className="h-full bg-gradient-to-r from-orange-400 to-[#F97316] rounded-full" style={{ width: `${match.matchScore}%` }} />
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Deal Age</p>
                    <p className="text-xs font-bold text-[#1F2937] flex items-center gap-1.5 mt-1">
                       <Clock size={12} className="text-gray-400" />
                       {match.age}
                    </p>
                 </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 pt-10 border-t border-gray-50">
                 
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Deal Type & Structure</label>
                    <div className="flex flex-col gap-1">
                       <p className="text-base font-bold text-[#1F2937]">{match.type}</p>
                       <p className="text-xs font-medium text-[#6B7280]">{match.structure}</p>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Revenue Range / Size</label>
                    <p className="text-base font-bold text-[#1F2937] flex items-center gap-2">
                       <TrendingUp size={16} className="text-green-500" />
                       {match.revenueRange}
                    </p>
                 </div>

                 <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sector Focus</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                       {match.sectors.map(sector => (
                          <span key={sector} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#4B5563]">
                             {sector}
                          </span>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Geography</label>
                    <p className="text-base font-bold text-[#1F2937] flex items-center gap-2">
                       <Globe size={16} className="text-blue-500" />
                       {match.geography}
                    </p>
                 </div>

                 <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Special Conditions & Notes</label>
                    <p className="text-sm font-medium text-[#4B5563] leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-gray-100 italic">
                       "{match.specialConditions}"
                    </p>
                 </div>
              </div>
           </div>

           {/* CTA BLOCK */}
           <div className="bg-gray-50 p-8 sm:p-10 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
                 <div className="space-y-2 text-center sm:text-left">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Transaction Authorization</p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                       <Coins size={18} className={hasTokens ? 'text-[#F97316]' : 'text-red-500'} />
                       <p className={`text-base font-bold ${hasTokens ? 'text-[#1F2937]' : 'text-red-600'}`}>
                          {hasTokens ? `Your balance: ${tokens ?? 0} tokens` : 'Insufficient tokens'}
                       </p>
                    </div>
                    {tokens === 0 && (
                       <p className="text-[10px] font-bold text-red-500">Balance: 0 tokens (Required: 50)</p>
                    )}
                 </div>

                 <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                    {hasTokens ? (
                       <button
                         onClick={handleSendEOI}
                         disabled={isSending}
                         className="w-full sm:w-auto bg-[#F97316] text-white px-10 py-4 rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:bg-[#EA580C] hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0"
                       >
                          {isSending ? (
                             <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending...
                             </>
                          ) : (
                             <>
                                Send EOI — 50 tokens
                                <Sparkles size={16} />
                             </>
                          )}
                       </button>
                    ) : (
                       <div className="flex flex-col items-center gap-4 w-full">
                          <button
                            disabled
                            className="w-full sm:w-auto bg-gray-200 text-gray-400 px-10 py-4 rounded-[20px] font-black text-xs uppercase tracking-widest cursor-not-allowed flex items-center justify-center gap-3"
                          >
                             Insufficient Tokens
                             <AlertCircle size={16} />
                          </button>
                          <Link 
                            href="/profile/billing"
                            className="text-xs font-black text-[#F97316] uppercase tracking-widest hover:underline"
                          >
                             Buy Tokens to Connect →
                          </Link>
                       </div>
                    )}
                    {hasTokens && (
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Token only deducted on approval</p>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* BOTTOM DISCLAIMER */}
        <div className="flex items-start gap-3 px-4 text-gray-400">
           <Info size={14} className="shrink-0 mt-0.5" />
           <p className="text-[10px] font-medium leading-relaxed">
              Expression of Interest allows you to signal intent to the counterparty. Your full professional identity will be shared once they review and accept your EOI.
           </p>
        </div>

      </div>
    </div>
  );
}
