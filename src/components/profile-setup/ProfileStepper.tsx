'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUser } from '../UserProvider';
import { 
  User, Mail, Phone, Building2, Globe, 
  ChevronRight, ChevronLeft, Sparkles, Zap, 
  MapPin, MessageSquare
} from 'lucide-react';
import MultiSelectChips from '@/components/profile-setup/MultiSelectChips';
import ProgressCircle from './ProgressCircle';
import ProgressBar from './ProgressBar';
import StepCard from './StepCard';
import AnimatedStepWrapper from './AnimatedStepWrapper';
import { useSession } from 'next-auth/react';

export interface FormData {
  fullName: string;
  workEmail: string;
  phone: string;
  firmName: string;
  role: string;
  professionalCategory: string[];
  customCategory: string;
  baseLocation: string;
  activeGeographies: string[];
  crossBorder: boolean;      // Rebuilt field
  corridors: string[];        // Rebuilt field
  primarySectors: string[];
  selectedDeals: string[];    // Rebuilt field
  prioritySectors: string[];
  coAdvisory: boolean;       // Rebuilt field
  collaborationModels: string[];
  intelligenceLayer: string;
}

export interface ProfileData {
  id?: string;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  firmName: string;
  role: string;
  category: string[];
  customCategory: string;
  baseLocation: string;
  geographies: string[];
  crossBorder: boolean;
  corridors: string;
  sectors: string[];
  intent: string;
  prioritySectors: string[];
  coAdvisory: boolean;
  collaborationModel: string[];
  additionalInfo: string;
  profileCompletion: number;
}

const INITIAL_DATA: FormData = {
  fullName: '',
  workEmail: '',
  phone: '',
  firmName: '',
  role: '',
  professionalCategory: [],
  customCategory: '',
  baseLocation: '',
  activeGeographies: [],
  crossBorder: false,
  corridors: [],
  primarySectors: [],
  selectedDeals: [],
  prioritySectors: [],
  coAdvisory: false,
  collaborationModels: [],
  intelligenceLayer: '',
};

interface ProfileStepperProps {
  onComplete: (showSuccess?: boolean) => void;
  onCancel?: () => void;
  initialData?: ProfileData | null;
}

export default function ProfileStepper({ onComplete, onCancel, initialData }: ProfileStepperProps) {
  const { updateReadiness, setOnboarding, addTokens } = useUser();
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialData ? {
    fullName: initialData.fullName || '',
    workEmail: initialData.email || '',
    phone: initialData.phone || '',
    firmName: initialData.firmName || '',
    role: initialData.role || '',
    professionalCategory: initialData.category || [],
    customCategory: initialData.customCategory || '',
    baseLocation: initialData.baseLocation || '',
    activeGeographies: initialData.geographies || [],
    crossBorder: initialData.crossBorder || false,
    corridors: initialData.corridors ? initialData.corridors.split(', ') : [],
    primarySectors: initialData.sectors || [],
    selectedDeals: initialData.intent ? initialData.intent.split(', ') : [],
    prioritySectors: initialData.prioritySectors || [],
    coAdvisory: initialData.coAdvisory || false,
    collaborationModels: initialData.collaborationModel || [],
    intelligenceLayer: initialData.additionalInfo || '',
  } : INITIAL_DATA);
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!initialData && session?.user && !hasHydrated.current) {
      hasHydrated.current = true;
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || session.user?.name || '',
        workEmail: prev.workEmail || session.user?.email || '',
        // @ts-expect-error - session.user is extended with custom DB fields
        phone: prev.phone || session.user?.phone || '',
      }));
    }
  }, [session, initialData]);

  const progress = useMemo(() => {
    const fields = [
      formData.fullName,
      formData.workEmail,
      formData.phone,
      formData.firmName,
      formData.role,
      formData.professionalCategory.length > 0,
      formData.baseLocation,
      formData.activeGeographies.length > 0,
      formData.primarySectors.length > 0,
      formData.selectedDeals.length > 0,
      formData.prioritySectors.length > 0,
      formData.collaborationModels.length > 0,
      formData.intelligenceLayer.length > 10,
    ];
    const filledCount = fields.filter(f => f).length;
    return Math.round((filledCount / fields.length) * 100);
  }, [formData]);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1: {
        const hasCategory = formData.professionalCategory.length > 0;
        const otherValid = !formData.professionalCategory.includes('Other') || !!formData.customCategory;
        return !!(formData.fullName && formData.workEmail && formData.phone && formData.firmName && formData.role && hasCategory && otherValid);
      }
      case 2:
        return !!(formData.baseLocation && formData.activeGeographies.length > 0);
      case 3:
        return formData.primarySectors.length > 0;
      case 4:
        return formData.selectedDeals.length > 0 && formData.prioritySectors.length > 0;
      case 5:
        return formData.collaborationModels.length > 0;
      case 6:
        return formData.intelligenceLayer.length > 10;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < 6) {
      setDirection('next');
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection('back');
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          deal_types: formData.selectedDeals,
          open_to_coadvisory: formData.coAdvisory,
          cross_border: formData.crossBorder,
          deal_corridors: formData.corridors,
          // Maintain compatibility with existing API expectations if needed
          intent: formData.selectedDeals.join(', '),
          corridors: formData.corridors.join(', '),
          progress 
        }),
      });
      const result = await response.json();
      
      updateReadiness('identity', 20);
      updateReadiness('geography', 15);
      updateReadiness('expertise', 15);
      updateReadiness('intent', 15);
      updateReadiness('collaboration', 15);
      updateReadiness('additional', 20);
      if (result.rewarded) addTokens(100);
      setOnboarding('profileCompleted', true);
      onComplete(result.shouldShowSuccess);
    } catch (error) {
      console.error('Profile submission error:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const STEPS = [
    { id: 1, label: 'Basic Identity' },
    { id: 2, label: 'Geography' },
    { id: 3, label: 'Expertise' },
    { id: 4, label: 'Current Intent' },
    { id: 5, label: 'Collaboration' },
    { id: 6, label: 'Intelligence' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-48">
      <div className="flex flex-col lg:flex-row gap-12 items-start relative">
        
        {/* LEFT SIDEBAR - Progress Panel */}
        <div className="w-full lg:w-[320px] lg:sticky lg:top-24 z-30">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <ProgressCircle progress={progress} size={60} strokeWidth={4} />
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-secondary opacity-50">Overall Progress</span>
                <div className="text-2xl font-black text-foreground tabular-nums">{progress}%</div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <span className="text-sm font-black text-foreground">Journey Progress</span>
                <span className="text-[10px] font-black text-brand-secondary">Step {currentStep}/6</span>
              </div>
              <ProgressBar progress={progress} />
            </div>

            <nav className="space-y-2 pt-4 border-t border-gray-50">
              {STEPS.map((step) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <div 
                    key={step.id}
                    onClick={() => {
                      if (step.id < currentStep) {
                        setDirection('back');
                        setCurrentStep(step.id);
                      } else if (step.id > currentStep && isStepValid(currentStep)) {
                        setDirection('next');
                        setCurrentStep(step.id);
                      }
                    }}
                    className={`flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer hover:bg-gray-50 ${
                      isActive 
                        ? 'bg-brand-accent/5 text-brand-accent' 
                        : isCompleted 
                          ? 'text-foreground/40' 
                          : 'text-brand-secondary/30'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      isActive 
                        ? 'bg-brand-accent animate-pulse' 
                        : isCompleted 
                          ? 'bg-green-500' 
                          : 'bg-gray-200'
                    }`} />
                    <span className="text-xs font-black uppercase tracking-widest">{step.label}</span>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        {/* RIGHT CONTENT - Main Form */}
        <div className="flex-1 w-full max-w-3xl min-h-[600px]">
          <div className="transition-all duration-500">
            <AnimatedStepWrapper direction={direction} isActive={currentStep === 1}>
              <StepCard title="Basic Identity" helper="Establish your professional identity within the network">
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputGroup label="Full Name" icon={<User size={16} />}>
                      <input type="text" value={formData.fullName} onChange={e => updateFormData({ fullName: e.target.value })} className="input-premium pl-12" placeholder="Legal Name" />
                    </InputGroup>
                    <InputGroup label="Work Email" icon={<Mail size={16} />}>
                      <input type="email" value={formData.workEmail} onChange={e => updateFormData({ workEmail: e.target.value })} className="input-premium pl-12" placeholder="name@firm.com" />
                    </InputGroup>
                    <InputGroup label="Phone Number" icon={<Phone size={16} />}>
                      <input type="tel" value={formData.phone} onChange={e => updateFormData({ phone: e.target.value })} className="input-premium pl-12" placeholder="+1 (555) 000-0000" />
                    </InputGroup>
                    <InputGroup label="Firm Name" icon={<Building2 size={16} />}>
                      <input type="text" value={formData.firmName} onChange={e => updateFormData({ firmName: e.target.value })} className="input-premium pl-12" placeholder="Company Name" />
                    </InputGroup>
                  </div>
                  <InputGroup label="Your Role">
                    <select value={formData.role} onChange={e => updateFormData({ role: e.target.value })} className="input-premium appearance-none cursor-pointer">
                      <option value="">Select your role</option>
                      <option value="Associate">Associate</option>
                      <option value="VP">VP / Director</option>
                      <option value="Managing Director">Managing Director</option>
                      <option value="Partner">Partner</option>
                      <option value="Founder">Founder</option>
                    </select>
                  </InputGroup>
                  <div className="space-y-6">
                    <MultiSelectChips 
                      label="Professional Category"
                      options={["M&A Advisor", "Investment Banker", "Business Broker", "Private Equity / VC", "Corporate Development", "Insolvency Professional", "Valuer", "Other"]}
                      selected={formData.professionalCategory}
                      onChange={(selected: string[]) => updateFormData({ professionalCategory: selected })}
                      grid
                    />
                    {formData.professionalCategory.includes("Other") && (
                      <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                        <InputGroup label="Specify your category">
                          <input type="text" value={formData.customCategory} onChange={e => updateFormData({ customCategory: e.target.value })} className="input-premium" placeholder="Your specific professional title" />
                        </InputGroup>
                      </div>
                    )}
                  </div>
                </div>
              </StepCard>
            </AnimatedStepWrapper>

            <AnimatedStepWrapper direction={direction} isActive={currentStep === 2}>
              <StepCard title="Geography & Coverage" helper="Define your operational deal-making jurisdictions">
                <div className="space-y-10">
                  <InputGroup label="Base Location" icon={<MapPin size={16} />}>
                    <input 
                      type="text" 
                      value={formData.baseLocation} 
                      onChange={e => updateFormData({ baseLocation: e.target.value })} 
                      className="input-premium pl-12" 
                      placeholder="e.g. Dubai, UAE" 
                    />
                  </InputGroup>

                  <MultiSelectChips 
                    label="Active Geographies" 
                    options={["North America", "Europe", "APAC", "Middle East", "Latin America", "Africa"]} 
                    selected={formData.activeGeographies} 
                    onChange={(selected: string[]) => updateFormData({ activeGeographies: selected })} 
                  />

                  {/* CROSS-BORDER TOGGLE */}
                  <div className="group">
                    <button 
                      type="button"
                      onClick={() => updateFormData({ crossBorder: !formData.crossBorder })}
                      className={`w-full flex items-center justify-between p-8 rounded-[32px] border-2 transition-all duration-300 ${
                        formData.crossBorder 
                          ? 'bg-brand-accent/5 border-brand-accent shadow-lg shadow-brand-accent/5' 
                          : 'bg-gray-50 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={`p-3 rounded-2xl transition-colors ${formData.crossBorder ? 'bg-brand-accent text-white' : 'bg-white text-gray-400'}`}>
                          <Globe size={20} />
                        </div>
                        <div>
                          <span className="block text-sm font-black text-foreground uppercase tracking-tight">Cross-border Deals</span>
                          <span className="block text-[11px] text-brand-secondary font-medium mt-0.5">Open to international capital corridors?</span>
                        </div>
                      </div>
                      <div className={`toggle-switch ${formData.crossBorder ? 'active' : ''}`}>
                        <div className="toggle-knob" />
                      </div>
                    </button>
                  </div>

                  {/* CONDITIONAL CORRIDORS */}
                  {formData.crossBorder && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                      <div className="px-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-secondary opacity-70">
                          Active Capital Corridors
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'india_usa', label: 'India → USA' },
                          { id: 'india_uae', label: 'India → UAE' },
                          { id: 'india_uk', label: 'India → UK' },
                          { id: 'india_sea', label: 'India → SE Asia' }
                        ].map(opt => {
                          const isSelected = formData.corridors.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const next = isSelected 
                                  ? formData.corridors.filter(c => c !== opt.id)
                                  : [...formData.corridors, opt.id];
                                updateFormData({ corridors: next });
                              }}
                              className={`p-6 rounded-2xl border-2 transition-all text-left group/chip ${
                                isSelected 
                                  ? 'bg-brand-accent/5 border-brand-accent shadow-sm' 
                                  : 'bg-white border-gray-100 hover:border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-black tracking-tight ${isSelected ? 'text-brand-accent' : 'text-foreground'}`}>
                                  {opt.label}
                                </span>
                                <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                                  isSelected ? 'bg-brand-accent border-brand-accent' : 'border-gray-200'
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </StepCard>
            </AnimatedStepWrapper>

            <AnimatedStepWrapper direction={direction} isActive={currentStep === 3}>
              <StepCard title="Market Expertise" helper="Select your primary sector specialization (Max 5)">
                <div className="space-y-8">
                  <MultiSelectChips label="Primary Sectors" options={["Technology", "Healthcare", "Real Estate", "Fintech", "Consumer", "Energy", "Logistics", "Manufacturing", "AI & Robotics", "EdTech"]} selected={formData.primarySectors} onChange={(selected: string[]) => updateFormData({ primarySectors: selected })} maxSelections={5} grid />
                </div>
              </StepCard>
            </AnimatedStepWrapper>

            <AnimatedStepWrapper direction={direction} isActive={currentStep === 4}>
              <StepCard title="Current Intent" helper="What is your primary deal focus for the next 90 days?">
                <div className="space-y-10">
                  <div className="grid grid-cols-1 gap-5">
                    {[
                      { id: 'deal_origination', title: 'Deal Origination', desc: 'Seeking new mandates or investment targets.' },
                      { id: 'strategic_exit', title: 'Strategic Exit', desc: 'Representing sellers for portfolio exits.' },
                      { id: 'joint_ventures', title: 'Joint Ventures', desc: 'Searching for local operating partners.' }
                    ].map(opt => {
                      const isSelected = formData.selectedDeals.includes(opt.id);
                      return (
                        <button 
                          key={opt.id} 
                          type="button"
                          onClick={() => {
                            const next = isSelected 
                              ? formData.selectedDeals.filter(id => id !== opt.id)
                              : [...formData.selectedDeals, opt.id];
                            updateFormData({ selectedDeals: next });
                          }} 
                          className={`w-full p-8 rounded-[32px] border-2 text-left transition-all duration-300 group ${
                            isSelected 
                              ? 'bg-brand-accent/5 border-brand-accent shadow-lg shadow-brand-accent/5 scale-[1.01]' 
                              : 'bg-gray-50 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className={`font-black text-lg tracking-tight transition-colors ${isSelected ? 'text-brand-accent' : 'text-foreground'}`}>
                              {opt.title}
                            </span>
                            <div className={`radio-dot ${isSelected ? 'active' : ''}`} />
                          </div>
                          <p className={`text-[12px] font-medium leading-relaxed transition-colors ${isSelected ? 'text-brand-accent/70' : 'text-brand-secondary opacity-70'}`}>
                            {opt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <MultiSelectChips 
                    label="Priority Focus Sectors" 
                    options={["SaaS", "Biotech", "Data Centers", "Renewables", "E-commerce"]} 
                    selected={formData.prioritySectors} 
                    onChange={(selected: string[]) => updateFormData({ prioritySectors: selected })} 
                    maxSelections={3} 
                  />
                </div>
              </StepCard>
            </AnimatedStepWrapper>

            <AnimatedStepWrapper direction={direction} isActive={currentStep === 5}>
              <StepCard title="Collaboration" helper="Define your preferred engagement models">
                <div className="space-y-10">
                  {/* CO-ADVISORY TOGGLE */}
                  <div className="group">
                    <button 
                      type="button"
                      onClick={() => updateFormData({ coAdvisory: !formData.coAdvisory })}
                      className={`w-full flex items-center justify-between p-8 rounded-[32px] border-2 transition-all duration-300 ${
                        formData.coAdvisory 
                          ? 'bg-brand-accent/5 border-brand-accent shadow-lg shadow-brand-accent/5' 
                          : 'bg-gray-50 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={`p-3 rounded-2xl transition-colors ${formData.coAdvisory ? 'bg-brand-accent text-white' : 'bg-white text-gray-400'}`}>
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <span className="block text-sm font-black text-foreground uppercase tracking-tight">Open to Co-Advisory</span>
                          <span className="block text-[11px] text-brand-secondary font-medium mt-0.5">Allow shared mandates or split-fee collaborations.</span>
                        </div>
                      </div>
                      <div className={`toggle-switch ${formData.coAdvisory ? 'active' : ''}`}>
                        <div className="toggle-knob" />
                      </div>
                    </button>
                  </div>
                  
                  <MultiSelectChips 
                    label="Collaboration Models" 
                    options={["Co-investment", "Finder's Fee", "Strategic Partnership", "Syndication"]} 
                    selected={formData.collaborationModels} 
                    onChange={(selected: string[]) => updateFormData({ collaborationModels: selected })} 
                  />
                </div>
              </StepCard>
            </AnimatedStepWrapper>

            <AnimatedStepWrapper direction={direction} isActive={currentStep === 6}>
              <StepCard title="Intelligence Layer" helper="Describe your specialization for the AI matching engine">
                <div className="space-y-8">
                  <InputGroup label="Deal Preferences" icon={<MessageSquare size={16} />}>
                    <textarea value={formData.intelligenceLayer} onChange={e => updateFormData({ intelligenceLayer: e.target.value })} rows={8} className="input-premium pt-12 resize-none" placeholder="e.g. We focus on pre-Series A SaaS in health-tech with $2M+ ARR. Prefer founder-led teams with US/UAE nexus." />
                  </InputGroup>
                  <div className="flex items-start gap-4 p-6 bg-orange-50/30 rounded-3xl border border-orange-100/50">
                    <Sparkles size={20} className="text-brand-accent shrink-0 mt-0.5" />
                    <p className="text-[12px] text-brand-secondary font-medium leading-relaxed">
                      <span className="font-black text-brand-accent">Intelligence Tip:</span> Detailed parameters increase match relevance by up to 300%.
                    </p>
                  </div>
                </div>
              </StepCard>
            </AnimatedStepWrapper>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 py-6 px-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button 
            onClick={handleBack} 
            disabled={currentStep === 1 || isSubmitting} 
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 shadow-sm ${
              currentStep === 1 
                ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' 
                : 'bg-white border-brand-accent/20 text-brand-accent hover:bg-brand-accent/5 hover:border-brand-accent hover:shadow-md'
            }`}
          >
            <ChevronLeft size={18} />
            Back
          </button>

          <button 
            onClick={handleNext} 
            disabled={!isStepValid(currentStep) || isSubmitting} 
            className={`flex items-center gap-4 px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-sm ${
              isStepValid(currentStep) 
                ? 'bg-[#0B1B2B] text-white hover:bg-brand-accent hover:shadow-lg hover:shadow-brand-accent/20 cursor-pointer transform hover:-translate-y-0.5' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-transparent'
            } group`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : currentStep === 6 ? (
              <>
                Finalize Profile
                <Zap size={16} className="fill-white" />
              </>
            ) : (
              <>
                Next Step
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
      
      <style jsx global>{`
        .input-premium {
          @apply w-full bg-white/60 backdrop-blur-sm border-2 border-gray-100 rounded-[20px] px-5 py-5 text-sm font-semibold transition-all shadow-sm;
          @apply focus:ring-8 focus:ring-brand-accent/5 focus:bg-white focus:border-brand-accent focus:shadow-xl focus:shadow-brand-accent/5;
          @apply placeholder:text-gray-300;
        }
        .card-select-premium {
          @apply p-6 rounded-[32px] border-2 border-transparent bg-gray-50 text-left transition-all hover:bg-gray-100 hover:border-gray-200;
        }
        .card-select-premium.active {
          @apply border-brand-accent bg-brand-accent/5 ring-8 ring-brand-accent/5 scale-[1.01] shadow-sm;
        }
        .toggle-premium {
          @apply flex items-center justify-between p-6 bg-gray-50 rounded-[32px] border border-gray-100 transition-all hover:bg-gray-100;
        }
        .toggle-switch {
          @apply w-14 h-8 rounded-full bg-gray-200 transition-all relative;
        }
        .toggle-switch.active {
          @apply bg-brand-accent;
        }
        .toggle-knob {
          @apply absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm;
        }
        .toggle-switch.active .toggle-knob {
          @apply left-7;
        }
        .radio-dot {
          @apply w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center transition-all bg-white;
        }
        .radio-dot.active {
          @apply bg-brand-accent border-brand-accent;
        }
        .radio-dot.active::after {
          content: '';
          @apply w-2 h-2 bg-white rounded-full shadow-sm;
        }
      `}</style>
    </div>
  );
}

function InputGroup({ label, children, icon }: { label: string, children: React.ReactNode, icon?: React.ReactNode }) {
  return (
    <div className="space-y-3 w-full relative">
      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-secondary ml-2 opacity-70 block">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-brand-accent">
            {icon}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
