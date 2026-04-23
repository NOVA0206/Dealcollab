'use client';
import React, { useEffect } from 'react';
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import TokenRewardDisplay from './TokenRewardDisplay';
import confetti from 'canvas-confetti';

interface ProfileSuccessScreenProps {
  onDashboardClick: () => void;
}

export default function ProfileSuccessScreen({ onDashboardClick }: ProfileSuccessScreenProps) {
  useEffect(() => {
    // Premium celebration blast
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-brand-card flex items-center justify-center p-6 py-20 animate-in fade-in duration-700 relative overflow-y-auto">
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-accent/5 rounded-full -mr-96 -mt-96 blur-[120px] opacity-40" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full -ml-72 -mb-72 blur-[120px] opacity-30" />
        {/* Subtle Confetti Particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-brand-accent/20 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-blue-400/10 rounded-full animate-bounce" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 left-1/2 w-2 h-2 bg-green-400/10 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-2xl w-full text-center space-y-12 animate-in scale-in-premium duration-1000 fill-mode-both">
        {/* SUCCESS CARD */}
        <div className="bg-white rounded-[48px] border border-brand-border p-12 sm:p-16 shadow-[0_32px_80px_rgba(31,41,55,0.08)] relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1.5 bg-brand-accent" />
          
          <div className="space-y-10">
            <div className="flex justify-center flex-col items-center gap-6">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 shadow-xl shadow-green-500/10 border-4 border-white animate-bounce duration-1000">
                <CheckCircle2 size={48} strokeWidth={1.5} />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black text-foreground tracking-tight">Your Deal Intelligence <br/> Profile is Ready</h2>
                <p className="text-brand-secondary text-lg font-medium">You’ve unlocked your intelligence layer and earned rewards.</p>
              </div>
            </div>

            <div className="h-px w-full bg-gray-100" />

            <TokenRewardDisplay finalAmount={100} />

            <div className="bg-orange-50/50 border border-orange-100/50 rounded-[24px] p-5 flex items-start gap-4 text-left max-w-md mx-auto">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-brand-accent shadow-sm shrink-0">
                <ShieldCheck size={18} />
              </div>
              <p className="text-[11px] font-medium text-orange-900 leading-normal">
                <span className="font-bold">Pro Tip:</span> Use your new tokens to connect with high-quality deal matches and unlock verified intelligence files.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={onDashboardClick}
          className="bg-foreground text-white px-12 py-5 rounded-2xl font-black text-lg hover:bg-brand-accent hover:shadow-2xl hover:shadow-brand-accent/20 transition-all flex items-center gap-3 mx-auto transform hover:-translate-y-1 active:scale-95"
        >
          Go to Dashboard
          <ArrowRight size={22} className="animate-in slide-in-from-left-4 duration-500" />
        </button>
      </div>
    </div>
  );
}
