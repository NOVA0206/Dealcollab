'use client';
import React from 'react';

interface AuthStepperProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
}

export default function AuthStepper({ currentStep, totalSteps, label }: AuthStepperProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full space-y-3 pb-2">
      <div className="flex justify-between items-end">
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-[#F97316] uppercase tracking-[0.2em] leading-none">
            {label || 'Onboarding Process'}
          </p>
          <h3 className="text-sm font-bold text-[#1F2937]">
            Step {currentStep} <span className="text-gray-400 font-medium">of {totalSteps}</span>
          </h3>
        </div>
        <span className="text-[10px] font-bold text-gray-400 tabular-nums">
          {Math.round(progress)}% Complete
        </span>
      </div>
      
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative">
        <div 
          className="h-full bg-gradient-to-r from-[#F97316] to-[#FB923C] rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(249,115,22,0.2)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
