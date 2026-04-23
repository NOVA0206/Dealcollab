'use client';
import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle2, Shield, Info, ArrowRight, Zap } from 'lucide-react';

interface SendEOIModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealName: string;
  onSuccess: (data: any) => void;
}

export default function SendEOIModal({ isOpen, onClose, dealName, onSuccess }: SendEOIModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    intent: '',
    background: '',
    interest: '',
    capacity: '',
    notes: ''
  });

  if (!isOpen) return null;

  const handleNext = () => setStep(prev => prev + 1);

  const handleSubmit = () => {
    onSuccess(formData);
    onClose();
  };

  const isStepComplete = (s: number) => {
    switch (s) {
      case 1: return !!formData.intent;
      case 2: return !!formData.background;
      case 3: return !!formData.interest;
      default: return true;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-[#1F2937]">Send Expression of Interest</h3>
            <p className="text-xs text-[#6B7280] font-medium mt-1">Reviewing: <span className="text-[#F97316]">{dealName}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-8 overflow-y-auto max-h-[70vh]">
          {step <= 5 ? (
            <div className="space-y-8">
              {/* Step 1: Intent */}
              <div className={`space-y-4 animate-in fade-in duration-500`}>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">1. Your Primary Intent</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Acquire', 'Invest', 'Partner', 'Explore'].map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setFormData({...formData, intent: option});
                        if (step === 1) handleNext();
                      }}
                      className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${
                        formData.intent === option 
                          ? 'border-[#F97316] bg-[#F97316]/5 text-[#F97316]' 
                          : 'border-gray-100 hover:border-[#F97316]/30 bg-gray-50'
                      }`}
                    >
                      {option}
                      {formData.intent === option && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Background (Revealed) */}
              {step >= 2 && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">2. Professional Background</label>
                  <textarea 
                    value={formData.background}
                    onChange={(e) => setFormData({...formData, background: e.target.value})}
                    placeholder="Briefly describe your firm or investment track record..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:border-[#F97316]/30 outline-none transition-all min-h-[100px] resize-none"
                  />
                  {formData.background.length > 50 && step === 2 && (
                    <button onClick={handleNext} className="text-xs font-bold text-[#F97316] flex items-center gap-1 hover:underline">
                      Next Step <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Step 3: Why this deal */}
              {step >= 3 && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">3. Why this deal?</label>
                  <textarea 
                    value={formData.interest}
                    onChange={(e) => setFormData({...formData, interest: e.target.value})}
                    placeholder="What specific strategic interest do you have in this proposal?"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:border-[#F97316]/30 outline-none transition-all min-h-[100px] resize-none"
                  />
                  {formData.interest.length > 50 && step === 3 && (
                    <button onClick={handleNext} className="text-xs font-bold text-[#F97316] flex items-center gap-1 hover:underline">
                      Final Details <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Step 4 & 5: Optional details */}
              {step >= 4 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">Investment Capacity (Optional)</label>
                    <input 
                      type="text"
                      value={formData.capacity}
                      onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                      placeholder="e.g. $500k - $2M"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-[#F97316]/30 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">Additional Notes</label>
                    <input 
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Any other comments..."
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-[#F97316]/30 outline-none transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* PREVIEW SECTION */
            <div className="space-y-8 animate-in zoom-in-98 duration-500">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-green-500" />
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Previewing Anonymous EOI</span>
                  </div>
                  <div className="bg-[#F97316]/10 text-[#F97316] text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
                     High Strength Profile
                  </div>
               </div>

               <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Intent</p>
                      <p className="text-sm font-bold text-[#1F2937]">{formData.intent}</p>
                    </div>
                    {formData.capacity && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Capacity</p>
                        <p className="text-sm font-bold text-[#1F2937]">{formData.capacity}</p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Background</p>
                    <p className="text-xs text-[#6B7280] leading-relaxed font-medium">{formData.background}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Strategic Interest</p>
                    <p className="text-xs text-[#6B7280] leading-relaxed font-medium italic">"{formData.interest}"</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[#F97316]">
                       <Zap size={10} /> AI Refinement: Suggesting emphasizing previous sector exit
                    </div>
                  </div>
               </div>

               <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Info size={16} className="text-blue-500 mt-0.5" />
                  <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                    Identity details (Sarah Jenkins, Ventura Capital) will remain 100% hidden until the receiver approves this EOI.
                  </p>
               </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          {step <= 5 ? (
            <>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i <= step ? 'w-6 bg-[#F97316]' : 'w-2 bg-gray-200'}`} />
                ))}
              </div>
              <button 
                onClick={() => step < 4 ? handleNext() : setStep(6)}
                disabled={!isStepComplete(step)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1F2937] text-white rounded-xl text-sm font-bold hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                {step >= 4 ? 'Review EOI' : 'Continue'} <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setStep(1)}
                className="text-xs font-bold text-[#6B7280] hover:text-[#1F2937] transition-colors"
              >
                ← Back to Edit
              </button>
              <button 
                onClick={handleSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-[#F97316] text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#EA580C] transition-all shadow-xl hover:shadow-[#F97316]/20 active:scale-95"
              >
                Send EOI — 50 tokens on approval
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
