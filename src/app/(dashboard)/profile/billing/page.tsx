'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Coins, CreditCard, ArrowRight,
  TrendingUp, ShieldCheck, Home
} from 'lucide-react';

export default function BillingPage() {
  const router = useRouter();
  const tokens = 0; // Static display or from provider
  const [selectedPlan, setSelectedPlan] = useState<number>(250);
  const [showModal, setShowModal] = useState(false);

  const plans = [
    { id: 250, tokens: 250, price: '₹8,299', description: 'Most Popular', icon: <TrendingUp size={20} />, recommended: true },
    { id: 500, tokens: 500, price: '₹14,999', description: 'Best Value', icon: <ShieldCheck size={20} /> }
  ];

  const handlePurchase = () => {
    setShowModal(true);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-white relative overflow-y-auto">
      
      {/* PAYMENTS COMING SOON MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          {/* Dark Backdrop (No Blur) */}
          <div className="absolute inset-0 bg-[#0B0F1A]/95" onClick={() => setShowModal(false)} />
          
          {/* Modal Card */}
          <div className="relative z-10 max-w-sm w-full bg-[#1F2937] rounded-[40px] p-10 border border-white/10 text-center shadow-[0_32px_80px_rgba(0,0,0,0.5)] animate-in zoom-in slide-in-from-bottom-8 duration-500">
            <div className="w-20 h-20 bg-[#F97316]/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[#F97316]/20">
              <CreditCard className="text-[#F97316]" size={32} />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Payments Coming Soon</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-10 px-4">
              We are finalizing our secure payment gateway. This feature will be accessible very soon.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => router.push('/home')}
                className="w-full py-4 bg-[#F97316] text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Home size={16} /> Go Back Home
              </button>
              
              <button 
                onClick={() => setShowModal(false)}
                className="w-full py-4 bg-white/5 text-gray-400 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all border border-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto w-full p-6 sm:p-10 space-y-12 pb-24">
        
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937] tracking-tight">Billing & Tokens</h1>
          <p className="text-[#6B7280] text-sm font-medium mt-1">Manage your platform credits and subscription</p>
        </div>

        {/* TOKEN BALANCE CARD */}
        <div className="bg-[#1F2937] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#F97316]/20 to-transparent rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p className="text-[#9CA3AF] text-xs font-black uppercase tracking-[0.2em] mb-3">Available Credits</p>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-bold tabular-nums">{tokens}</span>
                <span className="text-[#F97316] text-xl font-bold">Tokens</span>
              </div>
              <p className="text-[#9CA3AF] text-xs font-medium mt-4">Last sync: Just now</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-center gap-4">
              <div className="bg-[#F97316] p-2 rounded-lg text-white">
                <Coins size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Usage Status</p>
                <p className="text-sm font-bold text-white">Optimal Account Health</p>
              </div>
            </div>
          </div>
        </div>

        {/* BUY TOKENS SECTION */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1F2937]">Select Token Package</h2>
            <span className="text-xs font-bold text-[#F97316] bg-[#F97316]/10 px-3 py-1 rounded-full">Secure Payment via Razorpay</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative flex flex-col p-8 rounded-[32px] border-2 transition-all duration-300 text-left group ${
                  selectedPlan === plan.id 
                    ? 'border-[#F97316] bg-white shadow-xl scale-[1.02]' 
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F97316] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    Recommended
                  </div>
                )}
                
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                  selectedPlan === plan.id ? 'bg-[#F97316] text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'
                }`}>
                  {plan.icon}
                </div>

                <div className="mb-8">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{plan.description}</p>
                  <p className="text-3xl font-bold text-[#1F2937]">{plan.tokens} Tokens</p>
                </div>

                <div className="mt-auto pt-8 border-t border-gray-50 flex items-baseline gap-2">
                  <p className="text-4xl font-black text-[#1F2937]">{plan.price}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">One-time</p>
                </div>

                <div className={`mt-8 w-full py-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
                  selectedPlan === plan.id 
                    ? 'bg-[#F97316] text-white shadow-lg shadow-[#F97316]/20' 
                    : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'
                }`}>
                  {selectedPlan === plan.id ? 'Selected Package' : 'Proceed to Payment'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PAYMENT CTA */}
        <div className="bg-gray-50 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm">
              <CreditCard className="text-gray-400" size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1F2937]">Checkout Securely</p>
              <p className="text-xs text-gray-500 font-medium tracking-tight">Netbanking, UPI, Cards supported</p>
            </div>
          </div>
          
          <button 
            onClick={handlePurchase}
            className="w-full md:w-auto px-10 py-5 bg-[#F97316] text-white rounded-[20px] text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:shadow-[#F97316]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            Proceed to Payment <ArrowRight size={18} />
          </button>
        </div>

      </div>
    </div>
  );
}
