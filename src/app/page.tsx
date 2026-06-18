'use client';
import React, { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { useUser } from '@/components/UserProvider';
import VideoBackground from '@/components/auth/VideoBackground';
import VideoLogo from '@/components/auth/VideoLogo';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import GmailOTPFlow from '@/components/auth/GmailOTPFlow';
import AuthStepper from '@/components/auth/AuthStepper';
import { ShieldCheck, Sparkles, AlertCircle, Info } from 'lucide-react';

const AuthContent = () => {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { profile } = useUser();
  const router = useRouter();
  
  const error = searchParams.get('error');
  const logoutSuccess = searchParams.get('logout') === 'success';

  const [step, setStep] = useState<'google' | 'verified'>('google');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  // 1. Redirect Effect (The "Brain")
  useEffect(() => {
    if (isVerified) {
      console.log("SUCCESS: Identity Verified. Redirecting to /home...");
      
      // UX Delay (800ms)
      const redirectTimer = setTimeout(() => {
        console.log("Redirect triggered → /home");
        router.push('/home');
      }, 800);

      // Fallback Hard Redirect (3000ms) - Safety for edge cases
      const fallbackTimer = setTimeout(() => {
        console.log("Safety Fallback triggered → Refreshing to /home");
        window.location.href = '/home';
      }, 3000);

      return () => {
        clearTimeout(redirectTimer);
        clearTimeout(fallbackTimer);
      };
    }
  }, [isVerified, router]);

  // 2. Routing state machine — the ONLY routing rule:
  //   authenticated + phone exists  → /home
  //   authenticated + no phone      → phone collection step
  //   unauthenticated               → login form (handled by render)
  useEffect(() => {
    if (!mounted || status !== 'authenticated' || !session?.user) return;

    // Guard: already routing to /home — don't re-evaluate and risk reverting to phone step
    // while the session update() from PhoneVerification is still in-flight.
    if (isVerified || step === 'verified') return;

    // @ts-expect-error - phone is injected by the NextAuth session callback from DB
    const sessionPhone = session.user.phone as string | null | undefined;
    const dbPhone = profile?.phone ?? null;
    const hasPhone = !!(sessionPhone || dbPhone);

    console.log('[AUTH ROUTER]', {
      user: session.user.email,
      sessionPhone: sessionPhone ?? '(none)',
      dbPhone: dbPhone ?? '(none)',
      hasPhone,
      profileLoaded: profile !== null,
      step,
    });

    // Fast path: phone is already in the session (populated from DB by session callback).
    // Route to /home immediately — no need to wait for the profile API call.
    if (sessionPhone) {
      console.log('[AUTH] ✓ Phone in session → /home');
      setStep('verified');
      setIsVerified(true);
      return;
    }

    // Session has no phone — wait briefly for the profile fetch to complete
    // (covers the edge case where phone exists in DB but session wasn't refreshed yet).
    if (profile === null) {
      console.log('[AUTH] No session phone; awaiting profile load...');
      return;
    }

    // Profile loaded — check it for a phone
    if (hasPhone) {
      console.log('[AUTH] ✓ Phone in profile → /home');
      setStep('verified');
      setIsVerified(true);
      return;
    }

    // No phone → dedicated phone-collection page
    console.log('[AUTH] No phone found → /save-phone-number');
    router.push('/save-phone-number');
  }, [mounted, status, session, profile, step, isVerified, router]);

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn('google');
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 py-10 overflow-y-auto">
      <VideoBackground />

      <div className="relative z-20 w-full max-w-md space-y-8">
        {/* Logo Section */}
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-6 duration-1000">
          <VideoLogo />
          <div className="mt-6 text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">DealCollab AI</h1>
            <p className="text-white/60 text-[10px] sm:text-xs mt-2.5 font-bold tracking-[0.3em] uppercase italic">
              INDIA&apos;S M&A INTELLIGENCE NETWORK
            </p>
          </div>
        </div>

        {/* Auth Page Controller */}
        <div className="bg-white/95 backdrop-blur-2xl rounded-[32px] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 animate-in fade-in zoom-in duration-700 relative max-h-[90vh] overflow-y-auto scrollbar-hide">
          
          {/* Top Progress Bar */}
          {step !== 'verified' && (
            <div className="mb-8">
              <AuthStepper
                currentStep={1}
                totalSteps={1}
                label="Identity Setup"
              />
            </div>
          )}

          {/* Feedback Banners */}
          {error && (
            <div className="mb-6 p-4 bg-primary-soft border border-border rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
               <div className="bg-primary/20 p-1.5 rounded-lg text-primary-hover">
                  <AlertCircle size={18} />
               </div>
               <p className="text-sm font-bold text-foreground leading-tight">
                  {error === 'phone_linked_to_other' 
                    ? 'Security Rule: Number linked to another account' 
                    : 'Session update failed. Please retry.'}
               </p>
            </div>
          )}

          {logoutSuccess && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-100/50 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
               <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-600">
                  <ShieldCheck size={18} />
               </div>
               <p className="text-sm font-bold text-blue-700">Logged out successfully</p>
            </div>
          )}

          {/* Step 1: Google Authentication */}
          {/* During 'loading' AND 'authenticated' show a spinner — never flash the login form to a signed-in user */}
          {step === 'google' && (status === 'loading' || status === 'authenticated') && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {(() => { console.log('[AUTH] step=google status=' + status + ' — spinner'); return null; })()}
                {status === 'authenticated' ? 'Verifying Session...' : 'Securing Connection...'}
              </p>
            </div>
          )}
          {step === 'google' && status === 'unauthenticated' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-2 text-center pb-2">
                <h2 className="text-2xl font-black text-foreground tracking-tight italic">
                  WELCOME <span className="text-primary-hover">BACK</span>
                </h2>
                <p className="text-sm text-brand-secondary font-medium tracking-tight">
                  Institutional Access & Verified Deal Flow
                </p>
              </div>

              <div className="space-y-4">
                <GoogleAuthButton
                  onClick={handleGoogleSignIn}
                  isLoading={isLoading}
                />

                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <GmailOTPFlow />

                <p className="text-[10px] text-center text-gray-300 font-bold uppercase tracking-[0.2em] pt-2">
                  Secured by Google Identity
                </p>
              </div>

              <div className="pt-6 text-center border-t border-border">
                <div className="flex items-center justify-center gap-2 text-brand-secondary mb-1">
                  <Info size={12} className="text-primary-hover" />
                  <p className="text-[10px] font-medium italic">Private Beta Access Only</p>
                </div>
                <a
                  href="mailto:support@dealcollab.in"
                  className="text-[10px] font-bold text-brand-secondary hover:text-primary-hover transition-colors underline decoration-border underline-offset-4"
                >
                  Contact Membership Support
                </a>
              </div>
            </div>
          )}

          {/* Success State */}
          {step === 'verified' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-in fade-in zoom-in duration-1000">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse" />
                <div className="relative w-20 h-20 bg-green-500 text-white rounded-[24px] flex items-center justify-center shadow-2xl shadow-green-500/30">
                  <ShieldCheck size={40} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-[#1F2937] tracking-tight uppercase italic">Identity Linked</h2>
                <p className="text-sm text-gray-400 font-bold tracking-widest uppercase animate-pulse">
                  Establishing Deal Intelligence...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="flex justify-center gap-8 text-[10px] font-black text-white/30 uppercase tracking-[0.3em] animate-in fade-in duration-1000 delay-700">
           <div className="flex items-center gap-2">
             <Sparkles size={12} className="text-primary" />
             <span>AI Verified</span>
           </div>
           <span className="opacity-20">|</span>
           <span>Privacy First</span>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Securing Connection</p>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
