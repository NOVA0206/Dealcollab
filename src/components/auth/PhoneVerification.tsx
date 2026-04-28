'use client';
import React, { useState } from 'react';
import { Smartphone, Send, ShieldCheck, ArrowLeft, AlertCircle, PhoneCall, MessageSquare } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface PhoneVerificationProps {
  onVerify: () => void;
  onBack: () => void;
  initialPhone?: string | null;
  isFromWhatsApp?: boolean;
}

export default function PhoneVerification({ onVerify, onBack, initialPhone }: PhoneVerificationProps) {
  const [phone, setPhone] = useState(initialPhone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session, update } = useSession();

  const handleSubmit = async (e: React.FormEvent, method: 'whatsapp' | 'call' | 'manual' = 'manual') => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Auto-format country code if missing
    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone}`;

    if (formattedPhone.length < 10) {
       setError("Please enter a valid phone number.");
       setIsLoading(false);
       return;
    }

    try {
      if (session) {
        // CASE 1: User is already logged in with Google, just saving/linking phone
        const res = await fetch('/api/auth/save-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formattedPhone, verificationMethod: method }),
        });
        const data = await res.json();
        
        if (data.success || res.ok) {
          // Refresh the JWT with the new phone number.
          // Use try/catch so a transient DB issue doesn't block the user.
          try {
            await update();
          } catch (updateErr) {
            console.warn("[PhoneVerification] session.update() failed (non-fatal):", updateErr);
          }
          onVerify();
        } else {
          setError(data.error || "Failed to save phone number");
        }
      } else {
        // CASE 2: User is NOT logged in, trying to Login via Phone
        // 1. "Verify" the phone (Mock OTP)
        const verifyRes = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formattedPhone, code: '123456' }), // Mock code
        });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok) {
           setError(verifyData.error || "Phone verification failed");
           setIsLoading(false);
           return;
        }

        // 2. Trigger NextAuth Credentials Sign In
        const { signIn } = await import('next-auth/react');
        const result = await signIn('credentials', {
           phone: formattedPhone,
           redirect: false
        });

        if (result?.error) {
           setError("Login failed. Please try again.");
        } else {
           onVerify();
        }
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-all active:scale-90 text-gray-400 group"
        >
          <ArrowLeft size={18} className="group-hover:text-[#F97316] transition-colors" />
        </button>
        <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
          Identity Trust Layer
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100/50 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
           <div className="bg-red-500/10 p-1.5 rounded-lg text-red-600">
              <AlertCircle size={18} />
           </div>
           <p className="text-sm font-bold text-red-700 leading-tight">
              {error}
           </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-[#1F2937] tracking-tight">Contact Information</h3>
          <p className="text-sm text-gray-500 leading-relaxed font-medium">
            Please provide your primary contact number for <span className="text-[#F97316]">Deal Intelligence</span> delivery. No OTP required.
          </p>
        </div>

        <div className="group relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F97316] transition-colors">
            <Smartphone size={18} />
          </div>
          <input
            type="tel"
            placeholder="+91 Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white/60 backdrop-blur-sm border-2 border-gray-100 rounded-[20px] px-12 py-5 text-sm font-bold text-[#1F2937] focus:ring-8 focus:ring-[#F97316]/5 focus:bg-white focus:border-[#F97316] focus:shadow-xl focus:shadow-[#F97316]/5 transition-all outline-none placeholder:text-gray-300 shadow-sm"
            required
          />
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any, 'manual')}
            disabled={isLoading || !phone}
            className="w-full bg-[#1F2937] text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#F97316] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all shadow-xl hover:shadow-[#F97316]/20 disabled:opacity-50 group"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Save Phone Number
                <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3 pt-2">
             <button
                type="button"
                onClick={(e) => handleSubmit(e as any, 'whatsapp')}
                disabled={isLoading || !phone}
                className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-green-50 hover:border-green-200 hover:text-green-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <MessageSquare size={14} />
                Confirm via WhatsApp
             </button>
             <button
                type="button"
                onClick={(e) => handleSubmit(e as any, 'call')}
                disabled={isLoading || !phone}
                className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <PhoneCall size={14} />
                Verify via Call
             </button>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-50 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-gray-400">
          <ShieldCheck size={14} className="text-green-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Institutional Privacy Standard</span>
        </div>
        <p className="text-[9px] text-gray-300 font-medium text-center italic">
          Your number is safely encrypted and used exclusively for your deal log.
        </p>
      </div>
    </div>
  );
}
