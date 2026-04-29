export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const pdfModule = await import('pdf-parse');
    // Use specific type cast instead of any to satisfy linter
    const pdf = (pdfModule as Record<string, unknown>).default as ((b: Buffer) => Promise<{ text: string }>) || 
                (pdfModule as unknown as (b: Buffer) => Promise<{ text: string }>);
    const data = await pdf(buffer);
    return data.text;
  } 
  
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
    const mammothModule = await import('mammoth');
    const mammoth = (mammothModule as Record<string, unknown>).default as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> } || 
                    (mammothModule as unknown as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> });
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === 'text/plain') {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
