'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, FileText, Upload, X, XCircle } from 'lucide-react';

const CSV_TEMPLATE_HEADERS =
  'intent,sectors,geographies,description,deal_size_min,deal_size_max,revenue_min,revenue_max,deal_structure,advisor_name,contact_phone';

const CSV_TEMPLATE_EXAMPLE =
  'SELL_SIDE,"pharma,manufacturing","Mumbai,Delhi","Established pharma company with 3 manufacturing plants seeking strategic exit or PE investment",50,100,25,40,Majority Stake,Rajesh Sharma,9876543210\n' +
  'BUY_SIDE,saas,Bangalore,"PE fund seeking SaaS companies with recurring revenue model for bolt-on acquisition",100,500,20,80,Full Acquisition,,';

function downloadTemplate() {
  const content = CSV_TEMPLATE_HEADERS + '\n' + CSV_TEMPLATE_EXAMPLE;
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dealcollab_bulk_mandate_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type UploadPhase = 'idle' | 'uploading' | 'saving' | 'embedding' | 'complete' | 'error';

interface UploadResult {
  inserted: number;
  embedded: number;
  total: number;
  skipped: { row: number; reason: string }[];
}

export default function BulkUploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Only CSV files are supported. Export your Excel file as CSV first.');
      return;
    }
    setSelectedFile(file);
    setErrorMsg('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setPhase('uploading');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      setPhase('saving');
      const res = await fetch('/api/bulk-upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setPhase('error');
        setErrorMsg(data.error || 'Upload failed');
        return;
      }

      setPhase('complete');
      setResult(data);
    } catch (err) {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const reset = () => {
    setPhase('idle');
    setSelectedFile(null);
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-white h-full overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto p-6 sm:p-10 flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937] tracking-tight mb-1">Bulk Upload Mandates</h1>
          <p className="text-sm text-[#6B7280] font-medium">
            Upload a CSV file to add multiple mandates at once. Embeddings are generated automatically.
          </p>
        </div>

        {phase === 'complete' && result ? (
          /* ── Success State ── */
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-emerald-500" size={28} />
              <h2 className="text-xl font-bold text-[#1F2937]">Upload Complete</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                <span className="text-gray-700">
                  <span className="font-bold">{result.inserted}</span> mandate{result.inserted !== 1 ? 's' : ''} uploaded successfully
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                <span className="text-gray-700">
                  <span className="font-bold">{result.embedded}</span> mandate{result.embedded !== 1 ? 's' : ''} embedded successfully
                </span>
              </div>
              {result.skipped.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-700">
                      <span className="font-bold">{result.skipped.length}</span> row{result.skipped.length !== 1 ? 's' : ''} skipped due to validation errors
                    </span>
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">View skipped rows</summary>
                      <div className="mt-2 space-y-1">
                        {result.skipped.map((s) => (
                          <p key={s.row} className="text-xs text-red-600">
                            Row {s.row}: {s.reason}
                          </p>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push('/deal-log')}
                className="bg-[#F97316] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#EA580C] transition-all"
              >
                View Uploaded Mandates
              </button>
              <button
                onClick={reset}
                className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
              >
                Upload Another File
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Drop Zone ── */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#F97316] bg-[#F97316]/5'
                  : selectedFile
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-[#F97316]/50 hover:bg-[#F97316]/5'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {selectedFile ? (
                <>
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-emerald-200 shadow-sm">
                    <FileText size={24} className="text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[#1F2937]">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    <X size={12} /> Remove file
                  </button>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-gray-200 shadow-sm">
                    <Upload size={24} className="text-[#F97316]" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[#1F2937]">Drop your CSV file here</p>
                    <p className="text-sm text-gray-500">or click to browse</p>
                  </div>
                </>
              )}
            </div>

            {/* ── Error message ── */}
            {errorMsg && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ── Progress States ── */}
            {(phase === 'uploading' || phase === 'saving' || phase === 'embedding') && (
              <div className="space-y-3">
                {[
                  { key: 'uploading', label: 'Reading file...' },
                  { key: 'saving', label: 'Saving mandates to database...' },
                  { key: 'embedding', label: 'Generating embeddings...' },
                ].map(({ key, label }) => {
                  const phases = ['uploading', 'saving', 'embedding'];
                  const current = phases.indexOf(phase);
                  const step = phases.indexOf(key);
                  const isDone = step < current;
                  const isActive = step === current;
                  return (
                    <div key={key} className={`flex items-center gap-3 text-sm ${isDone ? 'text-emerald-600' : isActive ? 'text-[#F97316]' : 'text-gray-400'}`}>
                      {isDone ? (
                        <CheckCircle size={16} className="shrink-0" />
                      ) : isActive ? (
                        <div className="w-4 h-4 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-200 rounded-full shrink-0" />
                      )}
                      <span className={isActive ? 'font-semibold' : ''}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Actions ── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || phase !== 'idle'}
                className="flex-1 bg-[#F97316] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#EA580C] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {phase !== 'idle' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload Mandates
                  </>
                )}
              </button>

              <button
                onClick={downloadTemplate}
                className="border border-gray-200 text-gray-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                Download CSV Template
              </button>
            </div>

            {/* ── Format guide ── */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">CSV Format Guide</h3>
              <div className="space-y-1.5 text-xs text-gray-600">
                <p><span className="font-bold text-gray-800">Required:</span> intent, sectors, description</p>
                <p><span className="font-bold text-gray-800">Intent values:</span> BUY_SIDE, SELL_SIDE, FUNDRAISING, DEBT, STRATEGIC_PARTNERSHIP</p>
                <p><span className="font-bold text-gray-800">Optional:</span> geographies, deal_size_min, deal_size_max, revenue_min, revenue_max, deal_structure, advisor_name, contact_phone</p>
                <p><span className="font-bold text-gray-800">Multiple values:</span> Use comma-separated values inside quotes, e.g. <span className="font-mono bg-gray-100 px-1 rounded">&quot;pharma,manufacturing&quot;</span></p>
                <p><span className="font-bold text-gray-800">Size fields:</span> In Crore (INR), e.g. <span className="font-mono bg-gray-100 px-1 rounded">50</span> = ₹50 Cr</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
