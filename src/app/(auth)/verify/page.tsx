'use client';
import React, { useState, useEffect } from 'react';
import { useUser } from '@/components/UserProvider';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, MessageCircle, RefreshCw } from 'lucide-react';

export default function VerifyPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const { setOnboarding } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (value.length <= 1) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate verification
    setTimeout(() => {
      setOnboarding('phoneVerified', true);
      router.push('/home');
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-[32px] border border-[#E5E7EB] p-8 shadow-2xl shadow-[#1F2937]/5 animate-in fade-in zoom-in duration-500">
      <div className="space-y-6">
        <div className="space-y-2 text-center pb-2">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <ShieldCheck size={24} />
          </div>
          <h2 className="text-xl font-bold text-[#1F2937]">Verify Your Identity</h2>
          <p className="text-sm text-[#6B7280]">We&apos;ve sent a 6-digit code to your phone.</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-between gap-2">
            {code.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                className="w-12 h-14 bg-[#F9FAFB] border border-transparent rounded-xl text-center text-lg font-bold text-[#1F2937] focus:bg-white focus:border-[#F97316]/50 transition-all outline-none"
                required
              />
            ))}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#1F2937] text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#F97316] transition-all shadow-lg shadow-[#1F2937]/10 hover:shadow-[#F97316]/20 disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Verify & Finish
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="text-center">
           {timer > 0 ? (
             <p className="text-xs text-[#6B7280] font-medium">
               Resend code in <span className="text-[#F97316] font-bold">{timer}s</span>
             </p>
           ) : (
             <button 
               onClick={() => setTimer(30)}
               className="text-xs text-[#F97316] font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
             >
               <RefreshCw size={12} /> Resend OTP
             </button>
           )}
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-[#6B7280]">
           <MessageCircle size={14} />
           <span className="text-[10px] font-bold uppercase tracking-widest">SMS Gateway Active</span>
        </div>
      </div>
    </div>
  );
}
