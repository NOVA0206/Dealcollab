/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseOffice } from 'officeparser';
import zlib from 'zlib';
import OpenAI from 'openai';

// ─── DOM Polyfills for PDFJS ─────────────────────────────────────────────────
// pdfjs-dist legacy build requires these stubs to be defined on the global scope
// when run inside Node.js, even though we only extract text and do not render pages.
function installPDFJSPolyfills(): void {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      static fromMatrix() { return new (globalThis as any).DOMMatrix(); }
      multiply() { return this; }
      inverse() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
    };
  }
  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {
      addPath() {} arc() {} arcTo() {} bezierCurveTo() {} closePath() {}
      ellipse() {} lineTo() {} moveTo() {} quadraticCurveTo() {} rect() {}
    };
  }
  if (typeof globalThis.ImageData === 'undefined') {
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

// ─── Pure-JS PNG Encoder (Using Node.js Native Zlib) ─────────────────────────
// Encodes raw pixel data buffers to valid PNG files so they can be sent to GPT-4o Vision.
function rgbaToPng(width: number, height: number, rgba: Buffer): Buffer {
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])); // PNG Signature

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(createPngChunk('IHDR', ihdr));

  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));
  let rawOffset = 0;
  let rgbaOffset = 0;
  for (let y = 0; y < height; y++) {
    rawData[rawOffset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < rowSize; x++) {
      rawData[rawOffset++] = rgba[rgbaOffset++];
    }
  }

  const compressed = zlib.deflateSync(rawData);
  chunks.push(createPngChunk('IDAT', compressed));
  chunks.push(createPngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function imageToRgba(img: { width: number; height: number; data: Uint8ClampedArray; kind: number }): Buffer {
  const pixelCount = img.width * img.height;
  const rgba = Buffer.alloc(pixelCount * 4);
  let rgbaOffset = 0;
  let dataOffset = 0;

  if (img.kind === 3) {
    return Buffer.from(img.data);
  } else if (img.kind === 2) { // RGB
    for (let i = 0; i < pixelCount; i++) {
      rgba[rgbaOffset++] = img.data[dataOffset++];
      rgba[rgbaOffset++] = img.data[dataOffset++];
      rgba[rgbaOffset++] = img.data[dataOffset++];
      rgba[rgbaOffset++] = 255;
    }
  } else { // Grayscale
    for (let i = 0; i < pixelCount; i++) {
      const val = img.data[dataOffset++] || 0;
      rgba[rgbaOffset++] = val;
      rgba[rgbaOffset++] = val;
      rgba[rgbaOffset++] = val;
      rgba[rgbaOffset++] = 255;
    }
  }
  return rgba;
}

// ─── PDFJS Worker Resolver ───────────────────────────────────────────────────
let _pdfjsWorkerSrc: string | undefined;

async function resolvePDFJSWorker(): Promise<string> {
  if (_pdfjsWorkerSrc !== undefined) return _pdfjsWorkerSrc;

  try {
    const metaResolve = (import.meta as any).resolve as ((s: string) => string | Promise<string>) | undefined;
    if (typeof metaResolve === 'function') {
      const resolved = metaResolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      _pdfjsWorkerSrc = resolved instanceof Promise ? await resolved : resolved;
      return _pdfjsWorkerSrc;
    }
  } catch {
    // fall through
  }

  try {
    const { createRequire } = await import('module');
    const { pathToFileURL } = await import('url');
    const baseUrl = typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : 'file:///';
    const req = createRequire(baseUrl);
    const workerPath = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    _pdfjsWorkerSrc = pathToFileURL(workerPath).href;
    return _pdfjsWorkerSrc;
  } catch {
    // fall through
  }

  _pdfjsWorkerSrc = '';
  return _pdfjsWorkerSrc;
}

// ─── PDF Standard text extractor ─────────────────────────────────────────────
async function extractPDFWithPDFJS(buffer: Buffer): Promise<string> {
  const t0 = Date.now();
  installPDFJSPolyfills();

  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerSrc = await resolvePDFJSWorker();
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
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

// ─── PDF Scanned Image Extractor (Pure-JS, Vercel-compatible) ──────────────────
async function extractScannedPdfImages(buffer: Buffer): Promise<Buffer[]> {
  installPDFJSPolyfills();

  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerSrc = await resolvePDFJSWorker();
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pagesToProcess = Math.min(pdfDoc.numPages, 5); // Limit to first 5 pages for Vision cost control
  const pageImageBuffers: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const ops = await page.getOperatorList();
      let largestImg: any = null;
      let largestArea = 0;

      // Scan operator list to find painted images
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjs.OPS.paintImageXObject || ops.fnArray[i] === pdfjs.OPS.paintInlineImageXObject) {
          const imgId = ops.argsArray[i][0];
          const img = page.objs.get(imgId) || page.commonObjs.get(imgId);
          if (img && img.width && img.height && img.data) {
            const area = img.width * img.height;
            if (area > largestArea) {
              largestArea = area;
              largestImg = img;
            }
          }
        }
      }

      if (largestImg) {
        console.log(`[PDF] Page ${pageNum}: Found scanned image (${largestImg.width}x${largestImg.height})`);
        const rgba = imageToRgba(largestImg);
        const pngBuf = rgbaToPng(largestImg.width, largestImg.height, rgba);
        pageImageBuffers.push(pngBuf);
      }
      page.cleanup();
    } catch (err) {
      console.warn(`[PDF] Page ${pageNum} image extraction failed:`, err);
    }
  }

  return pageImageBuffers;
}

// ─── Image Vision AI Extractor ───────────────────────────────────────────────
async function extractTextFromImageWithVision(buffer: Buffer, mimeType: string): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not set for Vision AI fallback.');

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const base64Image = buffer.toString('base64');
  const apiMimeType = mimeType === 'image/tiff' ? 'image/png' : mimeType;

  console.log(`[VISION] Calling OpenAI gpt-4o for image extraction (${(buffer.length / 1024).toFixed(1)}KB)...`);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert document OCR engine.
Extract all text, titles, numbers, and tables from the provided image.
Preserve the layout and formatting. Do not write summaries or introductory text.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${apiMimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 2548,
    temperature: 0,
  });

  return response.choices[0]?.message?.content || '';
}

// ─── Text & Legacy Strings Fallbacks ─────────────────────────────────────────
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, '')  // strip non-ASCII / mojibake
    .replace(/[ \t]+/g, ' ')              // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')           // collapse blank lines
    .trim();
}

function extractPrintableStrings(buffer: Buffer): string {
  let output = '';
  let currentString = '';
  for (let i = 0; i < buffer.length; i++) {
    const code = buffer[i];
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
      currentString += String.fromCharCode(code);
    } else {
      if (currentString.trim().length > 4) output += currentString + '\n';
      currentString = '';
    }
  }
  return cleanText(output);
}

// ─── Office AST Formatter ────────────────────────────────────────────────────
function formatOfficeAST(result: any): string {
  if (!result || typeof result !== 'object') return '';
  if (!result.children || !Array.isArray(result.children)) {
    return typeof result.toText === 'function' ? result.toText() : String(result);
  }

  let output = '';
  let currentSlide = 0;

  for (const child of result.children) {
    const type = child.type || '';
    const text = (child.text || '').trim();

    if (type === 'slide') {
      currentSlide++;
      output += `\n\n--- Slide ${currentSlide} ---\n`;
      if (text) output += `### ${text}\n`;
    } else if (type === 'heading') {
      output += `\n\n## ${text}\n`;
    } else if (type === 'paragraph') {
      if (text) output += `${text}\n`;
    } else if (type === 'list') {
      if (text) output += `* ${text}\n`;
    } else if (type === 'table') {
      if (child.rows && Array.isArray(child.rows)) {
        output += '\n';
        for (const row of child.rows) {
          if (row.cells && Array.isArray(row.cells)) {
            const cellTexts = row.cells.map((cell: any) => {
              if (typeof cell === 'string') return cell.trim();
              if (cell && typeof cell === 'object') return (cell.text || '').trim();
              return '';
            });
            output += `| ${cellTexts.join(' | ')} |\n`;
          }
        }
        output += '\n';
      }
    } else {
      if (text) output += `${text}\n`;
    }
  }

  return output.trim();
}

async function extractOfficeText(buffer: Buffer): Promise<string> {
  const result = await parseOffice(buffer);
  const formatted = formatOfficeAST(result);
  return cleanText(formatted);
}

// ─── File Type Detector ──────────────────────────────────────────────────────
function detectFileType(buffer: Buffer, mimeType: string, filename?: string): string {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext) return ext;
  }

  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/csv': 'csv',
    'text/plain': 'txt',
    'application/rtf': 'rtf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/tiff': 'tiff',
  };

  if (mimeMap[mimeType]) return mimeMap[mimeType];

  if (buffer.length > 4) {
    const hex = buffer.toString('hex', 0, 4).toUpperCase();
    if (hex === '25504446') return 'pdf';
    if (hex === '504B0304') return 'docx'; // default fallback for zip container
    if (hex === 'D0CF11E0') return 'doc';
    if (hex === '89504E47') return 'png';
    if (hex.startsWith('FFD8FF')) return 'jpg';
    if (hex === '52494646') return 'webp';
    if (hex.startsWith('49492A') || hex.startsWith('4D4D00')) return 'tiff';
  }

  return 'txt';
}

// ─── Universal Entry Point ───
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  filename?: string,
): Promise<string> {
  const t0 = Date.now();
  const fileType = detectFileType(buffer, mimeType, filename);
  const sizeKB = (buffer.length / 1024).toFixed(1);

  console.log(`[DOC] [INGESTION] File type: ${fileType} | MIME: ${mimeType} | Size: ${sizeKB}KB`);

  try {
    // CSV / TXT Plain Text extraction
    if (fileType === 'txt' || fileType === 'csv') {
      const text = cleanText(buffer.toString('utf-8'));
      console.log(`[DOC] Extracted ${text.length} chars in ${Date.now() - t0}ms`);
      return text || 'Empty text document.';
    }

    // PDF extraction pipeline
    if (fileType === 'pdf') {
      let text = '';

      // Stage 1: Standard text-based PDF extract
      try {
        text = await Promise.race<string>([
          extractPDFWithPDFJS(buffer),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('PDF standard extraction timed out')), 25_000)
          )
        ]);
      } catch (pdfErr) {
        console.warn(`[PDF] Standard extraction failed:`, pdfErr);
      }

      // Stage 2: OCR / Vision AI fallback for scanned PDFs
      if (text.length < 150) {
        console.log(`[PDF] Low text density (${text.length} chars) — initiating Vision AI fallback...`);
        try {
          const images = await Promise.race<Buffer[]>([
            extractScannedPdfImages(buffer),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('PDF image extraction timed out')), 15_000)
            )
          ]);

          if (images.length > 0) {
            console.log(`[PDF] Extracted ${images.length} images from scanned PDF. Processing with GPT-4o Vision...`);
            let visionText = '';
            for (let i = 0; i < images.length; i++) {
              try {
                const pageText = await Promise.race<string>([
                  extractTextFromImageWithVision(images[i], 'image/png'),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Page ${i + 1} Vision timed out`)), 25_000)
                  )
                ]);
                visionText += `\n--- Page ${i + 1} ---\n${pageText}`;
              } catch (pageErr) {
                console.error(`[PDF] Vision extraction failed for page ${i + 1}:`, pageErr);
              }
            }
            if (visionText.trim().length > 50) {
              text = cleanText(visionText);
              console.log(`[VISION] Completed Vision AI extraction: ${text.length} chars.`);
            }
          }
        } catch (visionErr) {
          console.error(`[PDF] Scanned PDF Vision AI extraction failed:`, visionErr);
        }
      }

      const elapsed = Date.now() - t0;
      console.log(`[DOC] [PDF] Final result: ${text.length} chars extracted in ${elapsed}ms`);
      return text || 'SCANNED_PDF_DETECTED: PDF text could not be extracted. Please upload a digitally created PDF.';
    }

    // Office formats: DOCX, PPTX, XLSX, RTF
    if (fileType === 'docx' || fileType === 'pptx' || fileType === 'xlsx' || fileType === 'rtf') {
      let text = '';
      try {
        text = await Promise.race<string>([
          extractOfficeText(buffer),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Office parser timed out')), 25_000)
          )
        ]);
      } catch (err) {
        console.warn(`[DOC] Office parser failed for ${fileType}:`, err);
      }

      // Legacy fallback strings extraction if office parser returned nothing
      if (!text || text.length < 50) {
        console.log(`[DOC] Office parser returned minimal text for ${fileType}. Attempting strings extraction...`);
        text = extractPrintableStrings(buffer);
      }

      const elapsed = Date.now() - t0;
      console.log(`[DOC] Final result: ${text.length} chars extracted in ${elapsed}ms`);
      return text;
    }

    // Legacy binary office formats: DOC, PPT, XLS
    if (fileType === 'doc' || fileType === 'ppt' || fileType === 'xls') {
      let text = '';
      // Step A: Attempt standard parser (as some .doc files might be wrapped docx)
      try {
        text = await extractOfficeText(buffer);
      } catch {}

      // Step B: Strings extraction fallback
      if (!text || text.length < 50) {
        console.log(`[DOC] Attempting binary strings extraction fallback for legacy format ${fileType}...`);
        text = extractPrintableStrings(buffer);
      }

      const elapsed = Date.now() - t0;
      console.log(`[DOC] Final legacy result: ${text.length} chars extracted in ${elapsed}ms`);
      return text;
    }

    // Raw Image support (PNG, JPG, JPEG, WEBP, TIFF)
    if (['png', 'jpg', 'jpeg', 'webp', 'tiff'].includes(fileType)) {
      let text = '';
      try {
        text = await Promise.race<string>([
          extractTextFromImageWithVision(buffer, mimeType),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Image Vision extraction timed out')), 28_000)
          )
        ]);
      } catch (err) {
        console.error('[VISION] Extraction failed for image:', err);
      }

      const elapsed = Date.now() - t0;
      console.log(`[DOC] [VISION] Final result: ${text.length} chars extracted in ${elapsed}ms`);
      return text || 'IMAGE_EXTRACTION_FAILED: Could not extract text from the uploaded image.';
    }

    console.warn(`[PARSER] Unsupported file format: ${fileType}`);
    return `[Unsupported file format: ${fileType} / ${mimeType}]`;

  } catch (globalErr) {
    console.error('[PARSER] Critical failure:', globalErr);
    return 'An error occurred while parsing the document. Please ensure it is not corrupted or password-protected.';
  }
}
