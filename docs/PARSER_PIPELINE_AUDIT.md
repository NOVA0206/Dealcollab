# PARSER PIPELINE AUDIT — DEALCOLLAB

This document traces the complete pipeline of DealCollab's document parsing, extraction, intelligence, state population, and qualification system. For every stage, we identify the input, output, failure modes, and potential data loss points.

---

## 1. Upload
*   **Input**: Raw file stream from the frontend client (multipart/form-data) or JSON payload with file metadata (name, size, type).
*   **Output**: Streamed file bytes in server memory (as Buffer) or temporary direct-upload references.
*   **Failure Modes**:
    *   File size exceeds the 50MB hard limit.
    *   Network connection breaks during streaming.
    *   Client sends incorrect content-type headers.
*   **Data Loss Points**:
    *   Loss of original file metadata (e.g., creation dates, author headers) which is discarded during form-data stream parsing.

---

## 2. Supabase Storage
*   **Input**: File Buffer, target folder path in the `pdfs` bucket, user ID.
*   **Output**: Supabase Storage upload payload confirming the file path.
*   **Failure Modes**:
    *   Supabase connection timeout (typically 30s limit).
    *   Database connection pool exhaustion on the Supabase backend.
    *   Write permission/Rls (Row Level Security) failures due to expired session tokens.
*   **Data Loss Points**:
    *   File upload fails entirely due to transient network spikes (resolved by implementing a 5-retry exponential backoff policy).

---

## 3. Public URL Generation
*   **Input**: Successfully stored bucket file path.
*   **Output**: Signed or public URL pointing to the file asset.
*   **Failure Modes**:
    *   Supabase bucket permission configurations are private, making the generated URL throw 403 Access Denied.
    *   Signature expiration on private URLs, breaking retrieval in future chat turns.
*   **Data Loss Points**: None (reference only).

---

## 4. Parse Document API Route
*   **Input**: POST request containing either a file URL (JSON) or multipart file attachment.
*   **Output**: Extracted plain text and structured JSON deal intelligence, database IDs for document and chat session.
*   **Failure Modes**:
    *   Vercel Serverless Function execution timeout (10s on Hobby, 30s-300s on Pro/Enterprise).
    *   Serverless container memory overflow (1024MB default limit) when loading extremely large documents.
*   **Data Loss Points**:
    *   Execution timeouts result in total failure to persist the document, forcing the user to re-upload.

---

## 5. File Detection
*   **Input**: Client-declared MIME type, file name extension, and the first 4 bytes of the file buffer (magic numbers).
*   **Output**: Canonical file extension classification (e.g., `pdf`, `docx`, `xls`, `png`).
*   **Failure Modes**:
    *   Spoofed or missing file extensions in filenames.
    *   Unsupported content-type headers.
    *   Unknown magic-number patterns.
*   **Data Loss Points**:
    *   Mismatched routing (e.g., routing a `.doc` file to the XML-based `.docx` parser) causing immediate extraction crash.

---

## 6. Parser Selection & Routing
*   **Input**: Canonical extension name.
*   **Output**: Router target (Text/CSV, PDF standard, scanned PDF operator list, Word/PPTX/Excel AST formatter, legacy binary string extraction, image vision fallback).
*   **Failure Modes**: None (simple mapping logic).
*   **Data Loss Points**: None.

---

## 7. Extraction
*   **Input**: Raw Buffer.
*   **Output**: Clean plain text string.
*   **Failure Modes**:
    *   PDF extraction crashes due to missing global constructors (`DOMMatrix`, `Path2D`, `ImageData`) in Node.js (resolved by polyfilling stubs).
    *   Native module dependencies (like `@napi-rs/canvas` or GraphicsMagick binaries) missing in Vercel's isolated Linux container.
    *   Password-protected or corrupted files.
*   **Data Loss Points**:
    *   Loss of layout structures (tables, margins, headings) causing a loss of context. Reconstructed by office AST-to-markdown custom formatting.
    *   Character set encoding mismatches (generating mojibake / raw hex garbage). Resolved by cleanText filters.

---

## 8. Scanned PDF & OCR (Vision Fallback)
*   **Input**: Scan-detected PDF buffer or image buffer.
*   **Output**: OCR-extracted plain text via LLM.
*   **Failure Modes**:
    *   GraphicsMagick/Ghostscript subprocesses fail due to missing server OS binaries (resolved by bypassing local OCR).
    *   OpenAI API rate limit or context length exceeded.
*   **Data Loss Points**:
    *   Capped page limit (Vision OCR limited to the first 5 pages of a scanned PDF for execution timeout safety).
    *   Failure to detect text in blurry or extremely low-contrast scan images.

---

## 9. Document Intelligence Engine
*   **Input**: Extracted raw text.
*   **Output**: Structured M&A JSON schema matching the `DocumentIntelligence` interface.
*   **Failure Modes**:
    *   LLM timeout (20s limit) or rate limit.
    *   JSON schema parsing crash due to invalid syntax or wrapping fences.
*   **Data Loss Points**:
    *   Text input truncated (capped at 12,000 characters to prevent 413 payload limits and keep context clean).
    *   Important details omitted because the LLM failed to map them to structured properties. Saved in `missing_information`.

---

## 10. State Population
*   **Input**: Structured M&A JSON object.
*   **Output**: Seeded `RouterState` inside `stateManager.ts`.
*   **Failure Modes**:
    *   Sector key validation failures (e.g. rejecting a valid sector due to casing or synonyms).
    *   Sub-sector detection mismatches.
*   **Data Loss Points**:
    *   *Critical Historical Loss*: Valuable extracted facts (capacity, utilization, customers, certifications, assets) were parsed but discarded by the state manager, resulting in chatbot qualification repeating those questions. Resolved by mapping them to canonical keys in `state.industry_data`.

---

## 11. Qualification & Question Elimination Engine
*   **Input**: `RouterState` containing populated fields and `industry_data` keys.
*   **Output**: System prompt compile with `# FIELDS ALREADY PROVIDED` header.
*   **Failure Modes**:
    *   If `m4_questions_asked` remains `false` after state seeding, the router loads M4 questions despite them already being answered in the uploaded document. Resolved by auto-setting `m4_questions_asked = true` if key fields are parsed.
*   **Data Loss Points**:
    *   Chatbot asks redundant questions, destroying user confidence.

---

## 12. Proposal Creation
*   **Input**: Seeded state + chat facts + final confirmed state details.
*   **Output**: Active matching M&A proposal.
*   **Failure Modes**:
    *   Incomplete context due to state loss during transitions.
*   **Data Loss Points**: None (sink only).
