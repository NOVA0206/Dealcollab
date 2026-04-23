'use client';
import React, { useRef } from 'react';

interface OTPInputProps {
  value: string[];
  onChange: (index: number, value: string) => void;
  isLoading?: boolean;
}

export default function OTPInput({ value, onChange, isLoading }: OTPInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 1) {
      onChange(index, val);
      if (val && index < 5) {
        inputs.current[index + 1]?.focus();
      }
    }
  };

  return (
    <div className="flex justify-between gap-3 sm:gap-4">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={isLoading}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onChange={(e) => handleChange(i, e)}
          className="w-full h-14 sm:h-16 bg-white/50 border border-[#E5E7EB] rounded-2xl text-center text-xl font-bold text-[#1F2937] focus:bg-white focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10 transition-all outline-none disabled:opacity-50"
          required
        />
      ))}
    </div>
  );
}
