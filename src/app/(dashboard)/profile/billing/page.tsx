'use client';
import React from 'react';
import { MessageSquare, CalendarDays, ArrowRight, Briefcase, TrendingUp, Globe } from 'lucide-react';

export default function BillingPage() {
  const features = [
    {
      icon: <TrendingUp size={20} />,
      title: 'Deal Intelligence',
      description: 'AI-driven mandate matching, sector insights, and counterparty intelligence tailored to your strategy.',
    },
    {
      icon: <Briefcase size={20} />,
      title: 'Investor Matchmaking',
      description: 'Precision-matched investor and acquirer introductions across PE, VC, family offices, and strategic buyers.',
    },
    {
      icon: <Globe size={20} />,
      title: 'Strategic Transactions',
      description: 'End-to-end support for M&A, fundraising, debt structuring, and partnership mandates.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-white relative overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full p-6 sm:p-10 space-y-12 pb-24">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937] tracking-tight">Connect With Our Team</h1>
          <p className="text-[#6B7280] text-sm font-medium mt-1">Speak with a specialist to explore tailored deal opportunities</p>
        </div>

        {/* HERO CARD */}
        <div className="bg-[#1F2937] rounded-[32px] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#F97316]/25 to-transparent rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-xl">
            <p className="text-[#F97316] text-xs font-black uppercase tracking-[0.2em] mb-4">DealCollab Intelligence Platform</p>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-4">
              Unlock tailored deal intelligence and private market access.
            </h2>
            <p className="text-[#9CA3AF] text-sm leading-relaxed mb-8">
              Speak with our team to explore tailored deal intelligence, investor matchmaking, and strategic transaction opportunities designed for your mandate.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="mailto:Letsconnect@dealzebra.io?subject=DealCollab Inquiry"
                aria-label="Email DealZebra Sales Team"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-[#F97316] text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg hover:bg-[#EA580C] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <MessageSquare size={18} />
                Contact Sales
              </a>
              <a
                href="tel:+918485011598"
                aria-label="Call DealZebra Sales Team"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-white/15 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <CalendarDays size={18} />
                Book a Demo
              </a>
            </div>
          </div>
        </div>

        {/* WHAT YOU GET */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#1F2937]">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 border border-gray-100 rounded-[24px] p-6 space-y-3 hover:border-[#F97316]/30 hover:bg-white hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 bg-[#F97316]/10 rounded-2xl flex items-center justify-center text-[#F97316]">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-[#1F2937]">{f.title}</h3>
                <p className="text-xs text-[#6B7280] leading-relaxed font-medium">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA FOOTER */}
        <div className="bg-gray-50 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8 border border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#1F2937]">Ready to get started?</h3>
            <p className="text-xs text-[#6B7280] font-medium mt-1">Our team typically responds within one business day.</p>
          </div>
          <a
            href="tel:+918485011598"
            aria-label="Call DealZebra Sales Team"
            className="w-full md:w-auto flex items-center justify-center gap-2 px-10 py-5 bg-[#1F2937] text-white rounded-[20px] text-sm font-black uppercase tracking-[0.2em] hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
          >
            Talk to Sales <ArrowRight size={18} />
          </a>
        </div>

      </div>
    </div>
  );
}
