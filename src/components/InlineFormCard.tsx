'use client';
import React from 'react';
import InputField from './InputField';

interface InlineFormCardProps {
  title?: string;
  fields: {
    label: string;
    placeholder: string;
    type?: string;
    value: string;
    onChange: (val: string) => void;
  }[];
  onSubmit: () => void;
  submitLabel?: string;
}

export default function InlineFormCard({ title, fields, onSubmit, submitLabel = "Submit" }: InlineFormCardProps) {
  return (
    <div className="mt-4 bg-primary-soft rounded-2xl shadow-sm border border-border p-5 space-y-4 animate-in slide-in-from-top-2 duration-500">
      {title && (
        <h4 className="text-sm font-semibold text-brand-secondary mb-2">{title}</h4>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field, idx) => (
          <InputField
            key={idx}
            label={field.label}
            placeholder={field.placeholder}
            type={field.type || "text"}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          />
        ))}
      </div>
      <button
        type="submit"
        onClick={onSubmit}
        className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-all active:scale-[0.98] shadow-md shadow-primary/20"
      >
        {submitLabel}
      </button>
    </div>
  );
}
