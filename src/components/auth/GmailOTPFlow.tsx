'use client';
import React, { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { Mail, ArrowLeft } from 'lucide-react';

type FlowStep = 'collapsed' | 'email' | 'code';

export default function GmailOTPFlow() {
  const { update } = useSession();
  const [flowStep, setFlowStep] = useState<FlowStep>('collapsed');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/gmail-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send code. Please try again.');
        return;
      }
      setFlowStep('code');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setIsLoading(true);
    setError('');
    console.log('[VERIFY CLICK] email:', email, '| code length:', code.length);
    try {
      const result = await signIn('gmail-otp', {
        email,
        code,
        redirect: false,
      });
      console.log('[OTP VERIFIED] signIn result — full object:', JSON.stringify(result));
      console.log('[OTP VERIFIED] result.ok:', result?.ok);
      console.log('[OTP VERIFIED] result.error:', result?.error);
      console.log('[OTP VERIFIED] result.status:', result?.status);
      console.log('[OTP VERIFIED] result.url:', result?.url);
      if (result?.error) {
        console.warn('[OTP VERIFIED] signIn returned error — NOT redirecting. Error:', result.error);
        setError('Invalid or expired code. Please try again.');
        return;
      }
      if (!result?.ok) {
        console.warn('[OTP VERIFIED] result.ok is false — session may not have been created');
        setError('Login failed. Please try again.');
        return;
      }
      console.log('[SESSION CREATED] Session confirmed — updating next-auth session client state');
      let updatedSession = null;
      try {
        updatedSession = await update();
      } catch (updateErr) {
        console.warn('[OTP VERIFIED] session.update() failed (non-fatal):', updateErr);
      }

      // update() runs the session callback server-side (DB strategy: getUser → full SELECT *),
      // so updatedSession.user.phone is populated from the DB without a separate /api/profile fetch.
      // @ts-expect-error - phone is a custom property injected by the session callback
      const phone = updatedSession?.user?.phone as string | null | undefined;

      console.log('[AUTH SUCCESS]');
      console.log('SESSION FOUND:', !!updatedSession);
      console.log('USER ID:', updatedSession?.user?.id ?? '(none)');
      console.log('PHONE NUMBER:', phone ?? '(none)');
      console.log('REDIRECT TARGET:', phone ? '/home' : '/save-phone-number', '— via state machine');
      // Do NOT navigate here. update() calls setSession() inside SessionProvider,
      // which React 18 batches — the context commit hasn't happened yet at this point
      // in the async handler. Any router.push fired here arrives at the destination
      // page before status=authenticated is visible, tripping the unauthenticated guard.
      //
      // The state machine in app/page.tsx watches [status, profile] via useEffect.
      // React guarantees effects fire after the state commit, so by the time
      // router.push('/save-phone-number') is called from there, the session is
      // fully committed. This is exactly how the Google Sign-In flow works.
    } catch (err) {
      console.error('[OTP VERIFIED] signIn threw exception:', err);
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (flowStep === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setFlowStep('email')}
        className="w-full bg-white text-[#1F2937] py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 border border-[#E5E7EB] hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
      >
        <Mail className="w-5 h-5 text-[#F97316]" />
        <span className="font-semibold tracking-tight">Continue with Gmail</span>
      </button>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {flowStep === 'email' && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setFlowStep('collapsed'); setError(''); setEmail(''); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gmail Login</span>
          </div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
            placeholder="Enter your email address"
            autoFocus
            className="w-full px-4 py-3 rounded-2xl border border-[#E5E7EB] text-sm text-[#1F2937] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
          />
          {error && <p className="text-xs text-red-500 font-medium pl-1">{error}</p>}
          <button
            type="button"
            onClick={handleSendOTP}
            disabled={isLoading || !email}
            className="w-full bg-[#F97316] text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#EA6C0A] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-orange-200"
          >
            {isLoading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : 'Send Verification Code'}
          </button>
        </>
      )}

      {flowStep === 'code' && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setFlowStep('email'); setError(''); setCode(''); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Check your Gmail</span>
          </div>
          <p className="text-xs text-gray-500 font-medium pl-1">
            Code sent to <span className="text-[#1F2937] font-bold">{email}</span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="— — — — — —"
            autoFocus
            className="w-full px-4 py-3 rounded-2xl border border-[#E5E7EB] text-sm text-[#1F2937] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all tracking-[0.5em] text-center font-bold"
          />
          {error && <p className="text-xs text-orange-500 font-medium pl-1">{error}</p>}
          <button
            type="button"
            onClick={handleVerify}
            disabled={isLoading || code.length !== 6}
            className="w-full bg-[#F97316] text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#EA6C0A] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-orange-200"
          >
            {isLoading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : 'Verify & Login'}
          </button>
          <button
            type="button"
            onClick={handleSendOTP}
            disabled={isLoading}
            className="w-full text-xs text-gray-400 hover:text-[#F97316] font-medium transition-colors pt-1 disabled:opacity-40"
          >
            Resend code
          </button>
        </>
      )}
    </div>
  );
}
