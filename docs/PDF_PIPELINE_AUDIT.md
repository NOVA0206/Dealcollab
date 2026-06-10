# PDF Pipeline Audit — DealCollab

**Date:** 2026-06-10  
**Scope:** Document parsing subsystem only. No changes to matchmaking, state manager, proposal flow, M3/M4, or chat architecture.

---

## Architecture Trace

```
Frontend Upload (multipart or JSON with pre-signed URL)
        ↓
POST /api/chat/parse-document
  src/app/api/chat/parse-document/route.ts
        ↓
Supabase Storage upload (pdfs bucket, 5-retry with backoff)
        ↓
extractTextFromFile(buffer, mimeType)
  src/lib/documentParser.ts
        ↓
PDF text extraction
        ↓
cleanAndStructureDocument(text)
  src/lib/intelligenceEngine.ts  →  Groq / OpenAI
        ↓
INSERT INTO documents (extracted_text, structured_data)
        ↓
INSERT INTO chat_sessions (state seeded from structured_data)
        ↓
Return { text, documentId, chatId, structured }
        ↓
Chat route uses document text as context in processIntelligence()
```

---

## Failure Analysis — Root Causes

### Cause 1: `pdf-parse` v2.4.5 requires `@napi-rs/canvas` (native binary)

**Package:** `pdf-parse@2.4.5` (installed, per `npm list`)  
**Entry point:** `dist/pdf-parse/cjs/index.cjs`  
**Problem:** The v2.x rewrite bundles a modified `pdfjs-dist` that attempts to load `@napi-rs/canvas` for PDF rendering. `@napi-rs/canvas` is a native Node.js addon with platform-specific binaries (`.node` files).

On Vercel's Lambda environment:
- The Linux x64 `.node` binary for `@napi-rs/canvas` is either missing from the bundle or cannot be loaded in the serverless context.
- Result: `Warning: Cannot find module @napi-rs/canvas`

**Why it works locally (Windows):** The Windows x64 binary IS present in `node_modules/@napi-rs/canvas-win32-x64-msvc/` after `npm install`.

---

### Cause 2: `DOMMatrix` is not defined in Node.js

**Where it happens:** `pdfjs-dist` (bundled inside `pdf-parse` v2.x) checks `globalThis.DOMMatrix` during module initialization.  
**Problem:** `DOMMatrix` is a browser Web API. It is not defined in the Node.js global scope unless explicitly polyfilled.  
**Sequence:**
1. `@napi-rs/canvas` fails to load → canvas's `DOMMatrix` export is unavailable
2. `pdfjs-dist` falls back to `globalThis.DOMMatrix` → also undefined
3. `pdfjs-dist` throws `DOMMatrix is not defined`
4. `pdf-parse` crashes at import time
5. The `catch` block in `extractTextFromFile` triggers OCR fallback

---

### Cause 3: OCR fallback requires Ghostscript (unavailable on Vercel)

**Package:** `pdf2pic@2.1.4`  
**Problem:** `pdf2pic` converts PDF pages to PNG images using GraphicsMagick or Ghostscript — system-level binaries not present on Vercel serverless.  
**Sequence in OCR path:**
1. `pdf2pic.fromBuffer(...)` called
2. Ghostscript/GraphicsMagick spawn fails
3. `catch` block logs: *"pdf2pic failed, usually means GraphicsMagick/Ghostscript is missing on Vercel"*
4. Returns the error string: `"[OCR Error] Dependencies missing..."`

---

### Cause 4: Tesseract.js v7 worker path changed

**Package:** `tesseract.js@7.0.0`  
**Problem:** tesseract.js v7 changed its internal worker script path. The route at `tesseract.js/src/worker-script/node/index.js` was valid in v4/v5 but was reorganized in v7.  
**Impact:** Even if pdf2pic were available, Tesseract initialization would fail.  
**Note:** This is moot because the OCR path is broken at the pdf2pic step before Tesseract is ever used.

---

### Cause 5: OCR timeout (240s) leaves 88 chars of error text

With all the above failures, the only text that reaches the AI is the error message strings themselves (~88 chars). These trigger the `< 150 chars` threshold, the OCR fallback is attempted, and after a 240-second timeout, the route returns garbage to the chat API. The AI receives garbage text and shows the generic welcome message.

---

## Library Audit

| Library | Version | Vercel-Safe | Issue |
|---|---|---|---|
| `pdf-parse` | 2.4.5 | **NO** | Requires `@napi-rs/canvas` (native binary missing on Vercel) |
| `pdfjs-dist` | 5.7.284 | **YES** (with polyfills) | Already installed; needs `DOMMatrix` polyfill + worker URL |
| `pdf2pic` | 2.1.4 | **NO** | Requires Ghostscript/GraphicsMagick (system binaries) |
| `tesseract.js` | 7.0.0 | **PARTIALLY** | Pure WASM works; but unusable without PDF→image conversion |
| `mammoth` | 1.12.0 | **YES** | Pure JS, no issues |
| `officeparser` | 6.1.1 | **YES** | Pure JS, no issues |

---

## Fix Strategy

### Primary PDF Extraction — `pdfjs-dist/legacy` (no canvas, no native deps)

Replace `pdf-parse` with direct use of `pdfjs-dist/legacy/build/pdf.mjs`:

1. Install minimal DOM polyfills (`DOMMatrix`, `Path2D`, `ImageData`) before first import
2. Resolve the worker path using `import.meta.resolve` (Node.js 20+) or `createRequire` fallback
3. Call `getDocument({ data, useWorkerFetch: false, disableFontFace: true })`
4. Iterate pages, call `getTextContent()`, join `item.str` values

**Verified working:** Tested in Node.js environment, extracts "Hello World Deal Data" from a synthetic PDF with zero errors.

### Scanned PDF Handling — Structured Warning (no Ghostscript dependency)

When `text.length < 150` after pdfjs extraction:
- Return a `SCANNED_PDF_DETECTED` warning string
- Never timeout, never crash
- User sees a clear actionable message

### OCR — Removed (Vercel serverless constraint)

OCR on Vercel serverless requires a canvas implementation to render PDF pages to images. Options that would work:
- `@napi-rs/canvas` — fails on Vercel (native binary)
- `node-canvas` (libcairo) — not available on Vercel
- External OCR API (Google Vision, AWS Textract) — future enhancement

Current fix: graceful structured warning replaces the 4-minute timeout.

### Timeouts

| Step | Old | New |
|---|---|---|
| PDF extraction | 285s (route-level) | 30s hard limit in documentParser |
| OCR | 240s (documentParser) | Removed |
| Route-level | 285s | 285s (unchanged — covers all steps) |

---

## Files Changed

### 1. `src/lib/documentParser.ts`
- Replaced `pdf-parse` with `pdfjs-dist/legacy` for PDF text extraction
- Added minimal `DOMMatrix` / `Path2D` / `ImageData` polyfills
- Replaced broken OCR path with structured scanned-PDF warning
- Added observability logs: `[PDF]`, `[OCR]`, `[EXTRACT]`, `[PARSER]`
- Added 30s timeout guard on PDF extraction

### 2. `next.config.ts`
- Added `pdfjs-dist` to `serverExternalPackages`
  - Prevents webpack from bundling the 6MB package
  - Ensures the worker `.mjs` file is accessible at its real node_modules path at runtime

---

## Observability Logs (New)

```
[PARSER] Received application/pdf | size: 234.5KB
[PDF] Loaded: 12 pages, processing up to 12
[PDF] Extracted 4821 chars in 1240ms
[EXTRACT] PDF done: 4821 chars in 1380ms

# Scanned PDF path:
[PDF] Low text density (43 chars) — document may be scanned.
[OCR] Skipping OCR: no Ghostscript/GraphicsMagick available on Vercel serverless.
[EXTRACT] Returning scanned-PDF warning (43 chars extracted).

# Timeout path:
[PDF] pdfjs-dist extraction failed: PDF extraction timed out after 30s
[PDF] Low text density (0 chars) — document may be scanned.
```

---

## Success Criteria

When user uploads `Project_Damodar.pdf` (text-based):

1. `[PDF] Loaded: N pages` logged
2. `[PDF] Extracted XXXX chars` logged
3. `cleanAndStructureDocument()` receives meaningful text
4. `documents` table row inserted with `extracted_text`
5. `chat_sessions` row inserted, state seeded from `initializeStateFromDocument`
6. Chat response references the document content (not generic welcome)

When user uploads a scanned PDF:

1. `SCANNED_PDF_DETECTED` warning returned as `extractedText`
2. Groq/OpenAI sees the warning and tells the user to upload a text-based PDF
3. No timeout, no crash, response in < 5s

---

## Not Changed

- Matchmaking engine
- State manager (`conversationState.ts`, `promptRouter.ts`)
- Quality gate (`dataQuality.ts`)
- M3 / M4 prompt modules
- Proposal creation flow
- Chat route (`/api/chat/route.ts`)
- Intelligence engine (`intelligenceEngine.ts`)
- Any scoring or matching logic
