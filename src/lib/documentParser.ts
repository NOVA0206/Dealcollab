import mammoth from 'mammoth';

/**
 * Vercel-Safe Document Parser v3.0
 *
 * PDF extraction uses pdfjs-dist/legacy directly — no canvas, no native binaries.
 * pdf-parse v2.x is NOT used (requires @napi-rs/canvas, which is missing on Vercel).
 * OCR via pdf2pic/Ghostscript is NOT used (system binaries unavailable on Vercel).
 * Scanned PDFs receive a structured warning instead of a 4-minute timeout.
 */

// ─── DOM Polyfills ────────────────────────────────────────────────────────────
// pdfjs-dist checks these globals during initialisation.
// They are only needed as stubs — text extraction never invokes canvas rendering.
function installPDFJSPolyfills(): void {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      static fromMatrix() { return new (globalThis as any).DOMMatrix(); }
      multiply() { return this; }
      inverse() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
    };
  }
  if (typeof globalThis.Path2D === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Path2D = class Path2D {
      addPath() {} arc() {} arcTo() {} bezierCurveTo() {} closePath() {}
      ellipse() {} lineTo() {} moveTo() {} quadraticCurveTo() {} rect() {}
    };
  }
  if (typeof globalThis.ImageData === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      colorSpace = 'srgb';
      constructor(w: number | Uint8ClampedArray, h?: number) {
        if (typeof w === 'number') {
          this.width = w; this.height = h ?? 0;
          this.data = new Uint8ClampedArray(w * (h ?? 0) * 4);
        } else {
          this.data = w; this.width = h ?? 0;
          this.height = this.data.length / (this.width * 4);
        }
      }
    };
  }
}

// ─── Text normalisation ───────────────────────────────────────────────────────
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, '')  // strip non-ASCII garbage / mojibake
    .replace(/[ \t]+/g, ' ')              // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')           // collapse excessive blank lines
    .trim();
}

// ─── PDF text extraction (pdfjs-dist/legacy, no canvas) ──────────────────────
// Cached worker URL so we resolve it only once per process lifetime.
let _pdfjsWorkerSrc: string | undefined;

async function resolvePDFJSWorker(): Promise<string> {
  if (_pdfjsWorkerSrc !== undefined) return _pdfjsWorkerSrc;

  try {
    // import.meta.resolve is available in Node.js 18.19+ / 20+ (Vercel default).
    // It returns a file:// URL directly — the safest approach in ESM context.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaResolve = (import.meta as any).resolve as ((s: string) => string | Promise<string>) | undefined;
    if (typeof metaResolve === 'function') {
      const resolved = metaResolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      _pdfjsWorkerSrc = resolved instanceof Promise ? await resolved : resolved;
      return _pdfjsWorkerSrc;
    }
  } catch {
    // fall through to next strategy
  }

  try {
    // Fallback: createRequire + pathToFileURL (works in CJS-compiled Next.js output)
    const { createRequire } = await import('module');
    const { pathToFileURL } = await import('url');
    const baseUrl = typeof import.meta !== 'undefined' && import.meta.url
      ? import.meta.url
      : 'file:///';
    const req = createRequire(baseUrl);
    const workerPath = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    _pdfjsWorkerSrc = pathToFileURL(workerPath).href;
    return _pdfjsWorkerSrc;
  } catch {
    // fall through to empty string (pdfjs will warn but still work for text extraction)
  }

  _pdfjsWorkerSrc = '';
  return _pdfjsWorkerSrc;
}

async function extractPDFWithPDFJS(buffer: Buffer): Promise<string> {
  const t0 = Date.now();
  installPDFJSPolyfills();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const workerSrc = await resolvePDFJSWorker();
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages: number = pdfDoc.numPages;
  const MAX_PAGES = 50;
  const pagesToProcess = Math.min(numPages, MAX_PAGES);

  console.log(`[PDF] Loaded: ${numPages} pages | processing: ${pagesToProcess} | size: ${(buffer.length / 1024).toFixed(1)}KB`);

  let fullText = '';
  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = (content.items as any[])
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ');
    fullText += pageText + '\n';
    page.cleanup();
  }

  const elapsed = Date.now() - t0;
  const cleaned = cleanText(fullText);
  console.log(`[PDF] Extracted ${cleaned.length} chars in ${elapsed}ms`);
  return cleaned;
}

// ─── DOCX extraction ──────────────────────────────────────────────────────────
export async function extractDocxText(fileBuffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return cleanText(result.value);
  } catch (err) {
    console.error('[DOCX] Extraction failed:', err);
    return '';
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const t0 = Date.now();
  console.log(`[PARSER] Received ${mimeType} | size: ${(buffer.length / 1024).toFixed(1)}KB`);

  try {
    // ── DOCX / DOC ────────────────────────────────────────────────────────────
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const text = await extractDocxText(buffer);
      console.log(`[EXTRACT] DOCX: ${text.length} chars in ${Date.now() - t0}ms`);
      return text || 'Document content could not be extracted from DOCX.';
    }

    // ── Plain text ────────────────────────────────────────────────────────────
    if (mimeType === 'text/plain') {
      const text = cleanText(buffer.toString('utf-8'));
      console.log(`[EXTRACT] TXT: ${text.length} chars`);
      return text || 'Empty text file.';
    }

    // ── PDF ───────────────────────────────────────────────────────────────────
    if (mimeType === 'application/pdf') {
      let text = '';

      // Step A: text extraction via pdfjs-dist/legacy — 30s hard limit
      try {
        text = await Promise.race<string>([
          extractPDFWithPDFJS(buffer),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('PDF extraction timed out after 30s')),
              30_000,
            ),
          ),
        ]);
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        console.warn('[PDF] pdfjs-dist extraction failed:', msg);

        if (msg.includes('timed out')) {
          return JSON.stringify({
            status: 'timeout',
            reason: 'PDF extraction exceeded 30s limit.',
            recommendation: 'Upload a smaller or text-based PDF, or paste deal details directly into the chat.',
          });
        }
        text = '';
      }

      // Step B: scanned-PDF detection (< 150 meaningful chars = likely image-only)
      if (text.length < 150) {
        console.log(`[PDF] Low text density (${text.length} chars) — document may be scanned.`);
        console.log('[OCR] Skipping: Ghostscript/GraphicsMagick unavailable on Vercel serverless.');

        const warning =
          'SCANNED_PDF_DETECTED: This document appears to be image-based (scanned). ' +
          'Text extraction returned fewer than 150 characters. ' +
          'Please upload a text-based PDF (digitally created, not scanned) for full analysis. ' +
          'Alternatively, paste the deal details directly into the chat.';

        console.log(`[EXTRACT] Returning scanned-PDF warning. Partial text: ${text.length} chars.`);
        return text.length > 20 ? `${text}\n\n${warning}` : warning;
      }

      console.log(`[EXTRACT] PDF: ${text.length} chars in ${Date.now() - t0}ms`);
      return text;
    }

    // ── Unsupported ───────────────────────────────────────────────────────────
    console.warn(`[PARSER] Unsupported MIME type: ${mimeType}`);
    return `[Unsupported File Type: ${mimeType}]`;

  } catch (globalErr) {
    console.error('[PARSER] Fatal error:', globalErr);
    return 'An error occurred while parsing the document. Please ensure the file is not password-protected.';
  }
}
