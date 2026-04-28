'use client';
import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function InputField({ label, error, className = '', ...props }: InputFieldProps) {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="text-[11px] font-bold text-brand-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`input-underline w-full py-2 text-foreground placeholder:text-brand-secondary/40 ${className}`}
        {...props}
      />
      {error && <p className="text-[10px] text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
}
