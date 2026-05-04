// lib/documentParser.ts
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';

/**
 * 🛠️ ROBUST DOCUMENT PARSING SYSTEM (v2.0)
 * Hybrid pipeline: pdf-parse -> OCR fallback (tesseract.js)
 */



/**
 * Clean and normalize extracted text
 */
function cleanText(text: string): string {
  if (!text) return "";
  
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, "") // Remove non-ASCII garbage
    .replace(/\s+/g, " ")               // Normalize whitespace
    .replace(/\n\s*\n/g, "\n\n")        // Keep meaningful line breaks
    .trim();
}

/**
 * Fallback OCR logic for scanned PDFs
 */
async function performOCR(buffer: Buffer): Promise<string> {
  console.log("[OCR] Starting extraction for scanned document...");
  
  // We process a limited number of pages for performance (Next.js timeout limits)
  const MAX_PAGES = 3; 
  let combinedText = "";
  
  try {
    const worker = await createWorker('eng');
    
    // Note: In a production environment without GraphicsMagick/Ghostscript,
    // pdf2pic might fail. We use a try-catch to ensure we don't crash.
    // For local Windows development, the user should have these installed 
    // if they want high-quality OCR, otherwise we log the failure.
    
    try {
      const { fromBuffer } = await import('pdf2pic');
      const options = {
        density: 100,
        format: "png",
        width: 800,
        height: 1100
      };
      
      const convert = fromBuffer(buffer, options);
      
      for (let i = 1; i <= MAX_PAGES; i++) {
        try {
          const page = await convert(i, true);
          if (page && 'base64' in page && page.base64) {
            console.log(`[OCR] Processing page ${i}...`);
            const pageBuffer = Buffer.from(page.base64, 'base64');
            const { data: { text } } = await worker.recognize(pageBuffer);
            combinedText += `\n--- Page ${i} ---\n${text}`;
          }
        } catch (pageErr) {
          console.warn(`[OCR] Failed to convert page ${i}:`, pageErr);
          break; // Stop if we can't convert pages
        }
      }
    } catch (picErr) {
      console.error("[OCR] pdf2pic initialization failed. Ensure GraphicsMagick is installed.", picErr);
      combinedText = "[OCR Error] Dependencies missing for scanned document parsing. Please upload a text-based PDF.";
    }

    await worker.terminate();
  } catch (err) {
    console.error("[OCR] Critical failure:", err);
    combinedText = "[OCR Critical Failure] Could not process document images.";
  }

  return combinedText;
}

export async function extractDocxText(fileBuffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return cleanText(result.value);
  } catch (err) {
    console.error("[DOCX] Extraction failed:", err);
    return "";
  }
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  console.log(`[PARSER] Received ${mimeType} (${buffer.length} bytes)`);

  let extractedText = "";

  try {
    // 1. DOCX Handling
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      extractedText = await extractDocxText(buffer);
    }

    // 2. Plain Text Handling
    else if (mimeType === 'text/plain') {
      extractedText = buffer.toString('utf-8');
    }

    // 3. PDF Handling (Main Logic)
    else if (mimeType === 'application/pdf') {
      try {
        // Step A: Fast extraction
        const parser = new PDFParse({ data: buffer });
        try {
          const data = await parser.getText();
          extractedText = data.text.trim();
        } finally {
          await parser.destroy();
        }
        
        console.log(`[PDF] Raw extraction length: ${extractedText.length}`);

        // Step B: Sufficiency Check (Threshold: 150 chars)
        if (extractedText.length < 150) {
          console.log("[PDF] Low text density detected. Attempting OCR fallback...");
          
          const ocrText = await performOCR(buffer);
          
          if (ocrText.length > 50) {
            extractedText = "NOTE: I’m processing this document using enhanced extraction as it appears to be scanned.\n\n" + ocrText;
          }
        }
      } catch (pdfErr) {
        console.warn("[PDF] Standard extraction failed, trying OCR...", pdfErr);
        extractedText = await performOCR(buffer);
      }
    }

    // 4. Unsupported Handling
    else {
      console.warn(`[PARSER] Unsupported MIME type: ${mimeType}`);
      extractedText = `[Unsupported File Type: ${mimeType}]`;
    }

    // Final Clean
    const finalResult = cleanText(extractedText);
    
    // Safety Guarantee: Never return empty/null if possible
    if (!finalResult || finalResult.length < 5) {
      return "Document content could not be fully extracted. It may be an empty file or protected.";
    }

    console.log(`[PARSER] Final extraction length: ${finalResult.length} chars`);
    console.log(`[PARSER] Preview: ${finalResult.slice(0, 100)}...`);
    
    return finalResult;

  } catch (globalErr) {
    console.error("[PARSER] Fatal error:", globalErr);
    return "An error occurred while parsing the document. Please ensure the file is not password-protected.";
  }
}
