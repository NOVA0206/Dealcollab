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
    <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4 animate-in slide-in-from-top-2 duration-500">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
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
        onClick={onSubmit}
        className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-md shadow-orange-500/20 mt-2"
      >
        {submitLabel}
      </button>
    </div>
  );
}
