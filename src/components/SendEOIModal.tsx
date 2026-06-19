'use client';
import React, { useState, useEffect } from 'react';
import { X, Shield, Info, ArrowRight, Loader2 } from 'lucide-react';

export interface EOIFormData {
  fullName: string;
  companyName: string;
  designation: string;
  email: string;
  phone: string;
  investmentInterest: string;
  website: string;
  ticketSize: string;
  geographyPreference: string;
  additionalNotes: string;
}

interface SendEOIModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealName: string;
  isSubmitting?: boolean;
  onSubmit: (data: EOIFormData) => Promise<void>;
  prefill?: Partial<EOIFormData>;
}

const EMPTY_FORM: EOIFormData = {
  fullName: '',
  companyName: '',
  designation: '',
  email: '',
  phone: '',
  investmentInterest: '',
  website: '',
  ticketSize: '',
  geographyPreference: '',
  additionalNotes: '',
};

function validate(data: EOIFormData): Partial<Record<keyof EOIFormData, string>> {
  const errors: Partial<Record<keyof EOIFormData, string>> = {};
  if (!data.fullName.trim()) errors.fullName = 'Required';
  if (!data.companyName.trim()) errors.companyName = 'Required';
  if (!data.designation.trim()) errors.designation = 'Required';
  if (!data.email.trim()) {
    errors.email = 'Required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Enter a valid email';
  }
  if (!data.phone.trim()) {
    errors.phone = 'Required';
  } else if (!/^\+?[0-9\s\-()]{7,20}$/.test(data.phone)) {
    errors.phone = 'Enter a valid phone number';
  }
  if (!data.investmentInterest.trim()) errors.investmentInterest = 'Required';
  return errors;
}

export default function SendEOIModal({
  isOpen,
  onClose,
  dealName,
  isSubmitting = false,
  onSubmit,
  prefill,
}: SendEOIModalProps) {
  const [form, setForm] = useState<EOIFormData>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Partial<Record<keyof EOIFormData, string>>>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...EMPTY_FORM, ...prefill });
      setErrors({});
      setTouched(false);
    }
  }, [isOpen, prefill]);

  if (!isOpen) return null;

  const set = (field: keyof EOIFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (touched && errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    await onSubmit(form);
  };

  const inputBase = 'w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:ring-1 outline-none transition-all';
  const inputNormal = `${inputBase} border-gray-200 focus:border-[#F97316] focus:ring-[#F97316]/20`;
  const inputError = `${inputBase} border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/30`;

  const field = (key: keyof EOIFormData) => (errors[key] ? inputError : inputNormal);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-[#1F2937]">Express Interest</h3>
            <p className="text-xs text-[#6B7280] font-medium mt-1">
              Deal: <span className="text-[#F97316]">{dealName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-8 py-7 space-y-8">

            {/* Required Section */}
            <div className="space-y-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">Contact Details</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={set('fullName')}
                    placeholder="Your full name"
                    className={field('fullName')}
                  />
                  {errors.fullName && <p className="text-[10px] text-red-500 font-bold">{errors.fullName}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={set('companyName')}
                    placeholder="Your company or fund name"
                    className={field('companyName')}
                  />
                  {errors.companyName && <p className="text-[10px] text-red-500 font-bold">{errors.companyName}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Designation <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={set('designation')}
                    placeholder="e.g. Partner, MD, Founder"
                    className={field('designation')}
                  />
                  {errors.designation && <p className="text-[10px] text-red-500 font-bold">{errors.designation}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="work@company.com"
                    className={field('email')}
                  />
                  {errors.email && <p className="text-[10px] text-red-500 font-bold">{errors.email}</p>}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="+91 98765 43210"
                    className={field('phone')}
                  />
                  {errors.phone && <p className="text-[10px] text-red-500 font-bold">{errors.phone}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Investment / Strategic Interest <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.investmentInterest}
                  onChange={set('investmentInterest')}
                  placeholder="Describe your interest in this opportunity and what you bring to the table..."
                  rows={4}
                  className={`${field('investmentInterest')} resize-none`}
                />
                {errors.investmentInterest && <p className="text-[10px] text-red-500 font-bold">{errors.investmentInterest}</p>}
              </div>
            </div>

            {/* Optional Section */}
            <div className="space-y-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">Additional Details (Optional)</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Website</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={set('website')}
                    placeholder="https://yourcompany.com"
                    className={inputNormal}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Investment Ticket Size</label>
                  <input
                    type="text"
                    value={form.ticketSize}
                    onChange={set('ticketSize')}
                    placeholder="e.g. ₹10–50 Cr"
                    className={inputNormal}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Geography Preference</label>
                  <input
                    type="text"
                    value={form.geographyPreference}
                    onChange={set('geographyPreference')}
                    placeholder="e.g. Pan-India, South India"
                    className={inputNormal}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Additional Notes</label>
                  <input
                    type="text"
                    value={form.additionalNotes}
                    onChange={set('additionalNotes')}
                    placeholder="Any other comments..."
                    className={inputNormal}
                  />
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
              <Shield size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                Your contact details remain confidential until the counterparty approves this Expression of Interest.
                <strong className="block mt-1">50 tokens will be deducted from your account only upon approval.</strong>
              </p>
            </div>

            {/* Token note */}
            <div className="flex items-start gap-2 text-gray-400">
              <Info size={13} className="shrink-0 mt-0.5" />
              <p className="text-[10px] font-medium leading-relaxed">
                Submitting this EOI does not deduct tokens. Tokens are deducted only when the counterparty accepts your request.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-[#6B7280] hover:text-[#1F2937] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 bg-[#F97316] text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#EA580C] transition-all shadow-xl hover:shadow-[#F97316]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit EOI <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
