'use client';
import React from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';

interface IntelligenceModuleProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  trend?: 'up' | 'down';
  metric?: string;
  visual?: React.ReactNode;
}

export default function IntelligenceModule({ 
  title, 
  description, 
  icon, 
  badge, 
  trend, 
  metric,
  visual 
}: IntelligenceModuleProps) {
  return (
    <div className="group relative bg-[#111827] border border-white/5 rounded-[32px] p-10 space-y-8 flex flex-col items-start transition-all duration-500 hover:bg-[#111827]/80 hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#C9A74D]/5 overflow-hidden">
      
      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A74D]/10 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 -mr-16 -mt-16" />
      
      {visual}

      <div className="relative z-10 w-full flex justify-between items-start">
         <div className="p-4 bg-[#0B1220] text-[#9CA3AF] rounded-2xl border border-white/5 shadow-inner transition-colors group-hover:text-[#F9FAFB] group-hover:border-[#C9A74D]/20">
            {icon}
         </div>
         {badge && (
            <span className="text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 bg-[#C9A74D]/10 text-[#C9A74D] rounded-full border border-[#C9A74D]/20">
               {badge}
            </span>
         )}
         {trend === 'up' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/5 text-green-500 rounded-full border border-green-500/10 scale-95 origin-right group-hover:scale-100 transition-transform">
               <TrendingUp size={12} />
               <span className="text-[10px] font-black uppercase tracking-widest">Surging</span>
            </div>
         )}
         {metric && (
            <p className="text-3xl font-bold text-[#F9FAFB] tracking-tighter">{metric}</p>
         )}
      </div>

      <div className="relative z-10 space-y-4">
         <h4 className="text-xl font-bold text-[#F9FAFB] tracking-tight group-hover:text-[#C9A74D] transition-colors">{title}</h4>
         <p className="text-sm font-medium text-[#6B7280] leading-relaxed">
            {description}
         </p>
      </div>

      <div className="relative z-10 w-full pt-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
         <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A74D] border-b border-[#C9A74D]/20 pb-1">
            Explore Insight <ArrowUpRight size={14} />
         </button>
      </div>
    </div>
  );
}
