'use client';
import React, { useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import VideoBackground from '@/components/auth/VideoBackground';
import VideoLogo from '@/components/auth/VideoLogo';
import PhoneVerification from '@/components/auth/PhoneVerification';
import AuthStepper from '@/components/auth/AuthStepper';
import { ShieldCheck, Sparkles } from 'lucide-react';

function SavePhoneContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log('[SAVE-PHONE] mounted — status:', status, '| userId:', session?.user?.id ?? '(none)');

    if (status === 'loading') return;

    // @ts-expect-error - phone injected by NextAuth session callback
    const phoneNumber = session?.user?.phone as string | null | undefined;

    if (status === 'unauthenticated') {
      console.log('[SAVE-PHONE] REDIRECT TARGET: / (not authenticated)');
      router.replace('/');
      return;
    }

    console.log('[SAVE-PHONE] AUTH SUCCESS');
    console.log('[SAVE-PHONE] USER ID:', session?.user?.id);
    console.log('[SAVE-PHONE] PHONE NUMBER:', phoneNumber ?? '(none)');

    if (phoneNumber) {
      console.log('[SAVE-PHONE] REDIRECT TARGET: /home (phone already saved)');
      router.replace('/home');
    }
    // else: no phone → stay, render the phone collection form
  }, [status, session, router]);

  const handlePhoneSaved = () => {
    console.log('[SAVE-PHONE] Phone saved — REDIRECT TARGET: /home');
    window.location.href = '/home';
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Securing Connection...
        </p>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  // @ts-expect-error - phone injected by NextAuth session callback
  if (session?.user?.phone) return null;

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 overflow-y-auto">
      <VideoBackground />

      <div className="relative z-20 w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-6 duration-1000">
          <VideoLogo />
          <div className="mt-6 text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">DealCollab AI</h1>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2.5 font-bold tracking-[0.3em] uppercase italic">
              INDIA&apos;S M&A INTELLIGENCE NETWORK
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-2xl rounded-[32px] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 animate-in fade-in zoom-in duration-700">
          <div className="mb-8">
            <AuthStepper
              currentStep={1}
              totalSteps={1}
              label="Contact Setup"
            />
          </div>

          <PhoneVerification
            onVerify={handlePhoneSaved}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-center gap-8 text-[10px] font-black text-white/30 uppercase tracking-[0.3em] animate-in fade-in duration-1000 delay-700">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-[#F97316]" />
            <span>AI Verified</span>
          </div>
          <span className="opacity-20">|</span>
          <span>Privacy First</span>
        </div>
      </div>
    </main>
  );
}

export default function SavePhoneNumberPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Securing Connection</p>
      </div>
    }>
      <SavePhoneContent />
    </Suspense>
  );
}
