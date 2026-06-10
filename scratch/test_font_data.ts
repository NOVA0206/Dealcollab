import * as fs from 'fs';
import { extractTextFromFile } from '../src/lib/documentParser';

async function test() {
  const buffer = fs.readFileSync('Project_Damodar.pdf');
  
  // Directly test extractPDFWithPDFJS with standardFontDataUrl set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.7.284/standard_fonts/',
  });
  
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);
  const content = await page.getTextContent();
  const pageText = content.items.map((item: any) => item.str ?? '').join(' ');
  console.log("Extracted page text with CDN font data:\n", pageText);
}

test().catch(console.error);
