'use client';
import React from 'react';
import Link from 'next/link';
import { Shield, Sparkles, Zap, ChevronRight, Globe, BarChart3, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#F97316] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Sparkles className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">DealCollab AI</span>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">Features</a>
            <a href="#security" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">Security</a>
            <a href="#network" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">Network</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-bold text-gray-900 hover:text-[#F97316] transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-[#F97316] rounded-full text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Zap size={14} fill="currentColor" />
              <span>Next Gen M&A Intelligence</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 tracking-tighter leading-[1.1] mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              India&apos;s Most Powerful <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F97316] to-[#EA580C]">M&A Network</span>
            </h1>
            <p className="text-xl text-gray-500 font-medium leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-12 duration-1200">
              Accelerate deal sourcing, verify institutional identities, and analyze opportunities with proprietary AI. Built for the modern investment landscape.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-16 duration-1500">
              <Link href="/signup" className="group px-8 py-4 bg-[#F97316] text-white rounded-2xl text-lg font-bold hover:bg-[#EA580C] transition-all shadow-xl shadow-orange-500/30 flex items-center gap-2">
                Join the Network
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/" className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl text-lg font-bold hover:border-gray-200 transition-all">
                Member Portal
              </Link>
            </div>
          </div>

          {/* Abstract Visual */}
          <div className="mt-24 relative animate-in zoom-in duration-1500">
            <div className="absolute -inset-20 bg-gradient-to-t from-orange-50/50 to-transparent blur-3xl -z-10 rounded-full" />
            <div className="bg-white rounded-[40px] border border-gray-100 shadow-[0_32px_120px_rgba(0,0,0,0.1)] p-8 aspect-video overflow-hidden">
               <div className="w-full h-full bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Globe size={64} className="mx-auto text-gray-200 mb-4 animate-spin-slow" />
                    <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-xs">Intelligence Interface Live</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: <Shield className="text-orange-500" />, title: 'Identity Verification', desc: 'Secure institutional onboarding with multi-factor WhatsApp and Google identity verification.' },
              { icon: <BarChart3 className="text-orange-500" />, title: 'Deal Intelligence', desc: 'Real-time analysis of mandates and deal flow using proprietary LLM-trained models.' },
              { icon: <Users className="text-orange-500" />, title: 'Exclusive Network', desc: 'Connect with verified founders, bankers, and investors in a private ecosystem.' }
            ].map((feature, i) => (
              <div key={i} className="space-y-6">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md border border-gray-100">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="space-y-4">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                 <Sparkles className="text-white" size={16} />
               </div>
               <span className="text-lg font-bold tracking-tight">DealCollab AI</span>
             </div>
             <p className="text-sm text-gray-400 font-medium">© 2026 DealCollab AI. Institutional grade M&A intelligence.</p>
          </div>
          <div className="flex gap-12">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Platform</h4>
              <nav className="flex flex-col gap-2">
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900 font-medium">Analytics</a>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900 font-medium">Intelligence</a>
              </nav>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Company</h4>
              <nav className="flex flex-col gap-2">
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900 font-medium">Security</a>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900 font-medium">Privacy</a>
              </nav>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
