/* eslint-disable */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

console.log("pdfjs keys:", Object.keys(pdfjs));
if ((pdfjs as any).ImageKind) {
  console.log("ImageKind found:", (pdfjs as any).ImageKind);
} else {
  console.log("ImageKind not found directly on pdfjs");
}
