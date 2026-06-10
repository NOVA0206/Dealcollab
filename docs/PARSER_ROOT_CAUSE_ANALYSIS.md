# Document Parser Root Cause Analysis (RCA)

This document details the analysis of DealCollab's document parsing failure in the deployed Vercel serverless environment, specifically tracking issues regarding `pdfjs-dist`, missing worker modules, native dependencies, and OCR limitations.

---

## Executive Summary

The document processing pipeline fails on Vercel with a `0 chars extracted` error, which subsequently falls back to a warning. This occurs due to two major system bottlenecks:
1. **PDF Worker Module Resolution Failure**: The server-side dynamic lookup of `pdf.worker.mjs` fails in the serverless environment because Next.js does not bundle or trace runtime dynamic imports of asset files.
2. **Missing Native OS Dependencies for OCR**: The OCR library `pdf2pic` requires system-wide binaries (`Ghostscript` and `GraphicsMagick`), which do not exist in Vercel's serverless environment.

---

## Systemic Failures & Root Causes

### Failure A: `pdf.worker.mjs` Missing
*   **Exact File:** `src/lib/documentParser.ts`
*   **Exact Line:** Line 115 (setting `GlobalWorkerOptions.workerSrc` to the resolved worker URL) and Line 126 (`loadingTask.promise` invocation).
*   **Root Cause:** `pdfjs-dist` displays and parses PDFs on the server side using the fake worker or worker threads. Even when fake worker fallback is used, the display API internally executes `import('./pdf.worker.mjs')` dynamically to load context. Webpack / Next.js builds do not trace dynamic string-based references unless statically resolved, meaning `pdf.worker.mjs` is never copied into the Vercel deploy directory.
*   **Why Localhost Works:** The entire `node_modules` folder (containing the worker file) is physically present on disk, allowing standard Node modules resolution to find the worker file.
*   **Why Vercel Fails:** Vercel isolates individual route execution and only copies the specific files traced by `@vercel/nft` (Node File Trace). Since the worker file is not statically imported, it is left behind.
*   **Minimal Fix:** Add `outputFileTracingIncludes` configuration in `next.config.ts` to instruct Vercel's bundler to explicitly include `pdf.worker.mjs` for the `/api/chat/parse-document` API route.

---

### Failure B: `@napi-rs/canvas` Missing
*   **Exact File:** `package.json` (as dependency of `pdf-parse` v2.x) and `src/lib/documentParser.ts` (legacy fallback imports).
*   **Exact Line:** `const pdfParseModule = (await import('pdf-parse'))` (line 125 of original `documentParser.ts`).
*   **Root Cause:** The `pdf-parse` v2.x package relies on `@napi-rs/canvas` for canvas-based rendering and rasterization. `@napi-rs/canvas` requires native node addons (`.node` binary).
*   **Why Localhost Works:** Local npm installation matches the host architecture (e.g., Windows x64) and correctly downloads the corresponding `.node` binary.
*   **Why Vercel Fails:** Vercel runs lambdas in a restricted Linux x64 environment where pre-built native binaries must be specifically built or copied. If the build server cannot resolve the platform-specific native binary, it fails with a module loading error.
*   **Minimal Fix:** Completely bypass `pdf-parse` and use `pdfjs-dist/legacy` directly with canvas rendering turned off. This avoids loading any canvas or native binary dependencies altogether.

---

### Failure C: `DOMMatrix` Failures
*   **Exact File:** `src/lib/documentParser.ts`
*   **Exact Line:** Lines 15-28 (polyfill installer).
*   **Root Cause:** `pdfjs-dist` is designed to run in both browsers and Node.js. However, its display API expects browser Web APIs such as `DOMMatrix`, `Path2D`, and `ImageData` to exist in the global scope. In Node.js, these are undefined, leading to initialization errors.
*   **Why Localhost Works:** When `@napi-rs/canvas` is loaded successfully, it exports custom implementations of these constructors, which are polyfilled.
*   **Why Vercel Fails:** Since `@napi-rs/canvas` fails to load, the constructors remain undefined, crashing PDF.js initialization.
*   **Minimal Fix:** Explicitly install stubs/shims for `globalThis.DOMMatrix`, `globalThis.Path2D`, and `globalThis.ImageData` in Node's global object prior to importing the legacy PDF.js module.

---

### Failure D, E, F: OCR & System Binaries (`Ghostscript` / `GraphicsMagick`)
*   **Exact File:** `src/lib/documentParser.ts`
*   **Exact Line:** Lines 40-71 (OCR pipeline).
*   **Root Cause:** PDF-to-image rasterization in standard Node OCR libraries (like `pdf2pic`) relies on spawning system subprocesses for GraphicsMagick (`gm`) and Ghostscript (`gs`).
*   **Why Localhost Works:** Works if the developer has GraphicsMagick and Ghostscript installed locally and available in `PATH`.
*   **Why Vercel Fails:** Vercel Lambda containers are minimal read-only environments that do not contain GraphicsMagick, Ghostscript, or any custom OS binaries. Spawning `gs` or `gm` throws a `ENOENT` (command not found) error.
*   **Minimal Fix:** Implement two safe Vercel-compatible fallbacks:
    1. **For PDF Images**: Extract the embedded raw image streams directly from the PDF using the PDF.js operator list (`paintImageXObject`) in pure JS, avoiding any canvas rendering or OS sub-processes.
    2. **For Vision OCR**: Base64-encode the extracted images (or user-uploaded PNG/JPEG images) and run them through OpenAI's `gpt-4o` Vision API as a fallback, bypassing local OCR compilation.

---

### Failure G & H: Worker & Turbopack Bundling
*   **Exact File:** `next.config.ts`
*   **Exact Line:** Line 29 (`serverExternalPackages`).
*   **Root Cause:** Next.js uses Webpack (and Turbopack in dev mode) to compile client/server targets. If `pdfjs-dist` is bundled, Webpack attempts to resolve its native dependencies and worker structures, which fail to compile.
*   **Why Localhost Works:** Development servers run in local node environments without strict bundling isolation.
*   **Why Vercel Fails:** The production build fails or crashes during Webpack bundling because of unresolved modules or canvas imports.
*   **Minimal Fix:** Ensure `pdfjs-dist` is configured in Next.js's `serverExternalPackages` so it is loaded raw from `node_modules` at runtime and never processed by the Next.js Webpack compiler.

---

## Action Plan & Code Changes (Proposals)

### 1. `next.config.ts`
Add the trace instruction to explicitly include the worker file:
```typescript
const nextConfig: NextConfig = {
  ...
  outputFileTracingIncludes: {
    '/api/chat/parse-document': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
  serverExternalPackages: ['pdfjs-dist', 'officeparser', 'mammoth'],
};
```

### 2. `src/lib/documentParser.ts`
- Implement robust MIME-type and extension router.
- Use `pdfjs-dist/legacy/build/pdf.mjs` directly with stub polyfills.
- Build pure-JS image extraction from PDF operator lists.
- Construct a pure-JS PNG encoder using Node's native `zlib.deflateSync`.
- Build OpenAI `gpt-4o` Vision fallback for scanned documents and images.
- Utilize `officeparser` with custom markdown formatting.
- Construct a legacy binary string extractor (`extractPrintableStrings`) for `.doc`, `.xls`, `.ppt`.
