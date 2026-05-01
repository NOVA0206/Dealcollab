// lib/documentParser.ts
// Simplified parser — uses mammoth for DOCX, basic text extraction for others
// PDF OCR removed — not compatible with Windows/Next.js environment

export async function extractDocxText(fileBuffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value?.trim() || '';
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  console.log(`[PARSER] Processing ${mimeType}`);

  // DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return await extractDocxText(buffer);
  }

  // Plain text
  if (mimeType === 'text/plain') {
    return buffer.toString('utf-8').trim();
  }

  // PDF — attempt basic text extraction without any worker or browser APIs
  if (mimeType === 'application/pdf') {
    try {
      // Try to extract raw text directly from PDF binary
      // Many text-based PDFs have readable text in their raw bytes
      const raw = buffer.toString('latin1');
      const textMatches = raw.match(/\(([^)]{3,})\)/g) || [];
      const extracted = textMatches
        .map(m => m.slice(1, -1))
        .filter(t => /[a-zA-Z]{2,}/.test(t))
        .join(' ')
        .replace(/\\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();

      if (extracted.length > 100) {
        console.log(`[PDF] Raw extraction: ${extracted.length} chars`);
        return extracted;
      }
    } catch (e) {
      console.warn('[PDF] Raw extraction failed:', e);
    }

    // If raw extraction fails, this is an image-based PDF
    // Return an error that tells the user what to do
    throw new Error(
      'IMAGE_BASED_PDF: This PDF contains images rather than selectable text. ' +
      'Please convert it to DOCX format and upload again.'
    );
  }

  // Images — not supported
  if (mimeType.startsWith('image/')) {
    throw new Error(
      'IMAGE_NOT_SUPPORTED: Image OCR is not available. ' +
      'Please upload a DOCX or text-based PDF instead.'
    );
  }

  throw new Error(`UNSUPPORTED_TYPE: ${mimeType}. Supported: PDF (text-based), DOCX, TXT.`);
}
