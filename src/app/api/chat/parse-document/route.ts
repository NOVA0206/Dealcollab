import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { extractTextFromFile } from '@/lib/documentParser';
import { createServerSupabaseClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supported MIME types
const SUPPORTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data. Make sure the file is sent as multipart/form-data.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Send the file as a "file" field in the form data.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    const mimeType = file.type || '';
    if (!SUPPORTED_TYPES[mimeType]) {
      return NextResponse.json(
        { 
          error: `Unsupported file type: ${mimeType || 'unknown'}. Supported types: PDF, DOCX, PPTX, TXT, JPG, PNG, WEBP.`,
        },
        { status: 400 }
      );
    }

    console.log(`[PARSE] Processing file: ${file.name} | Type: ${mimeType} | Size: ${(file.size / 1024).toFixed(1)}KB`);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. UPLOAD TO STORAGE
    const fileName = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadErr } = await supabase.storage
      .from('pdfs')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadErr) {
      console.error('[STORAGE] Upload failed:', uploadErr);
      throw new Error(`Failed to upload document: ${uploadErr.message}`);
    }

    // 2. GET PUBLIC URL
    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(fileName);

    // 3. EXTRACT TEXT
    let extractedText = '';
    try {
      extractedText = await extractTextFromFile(buffer, mimeType);
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error('[PARSE] Extraction failed:', errMsg);
      throw new Error(`Extraction failed: ${errMsg}`);
    }

    const cleanText = extractedText.trim();

    // 4. GENERATE STRUCTURED INTELLIGENCE (Expert Engine)
    const { cleanAndStructureDocument } = await import('@/lib/intelligenceEngine');
    const structuredData = await cleanAndStructureDocument(cleanText);

    // 5. PERSIST IN DOCUMENTS TABLE (Resilient Insertion)
    let docData: { id: string } | null = null;
    try {
      const insertPayload = {
        user_id: userId || null,
        name: file.name || 'Untitled Document',
        url: publicUrl || null,
        extracted_text: cleanText || null,
        structured_data: structuredData || null,
      };

      console.log(`[DB] Attempting resilient insert into 'documents' table...`);
      const { data, error: dbErr } = await supabase
        .from('documents')
        .insert([insertPayload])
        .select('id')
        .single();

      if (dbErr) {
        console.error('[DB] PRIMARY INSERT FAILED:', {
          code: dbErr.code,
          message: dbErr.message,
          hint: dbErr.hint,
          details: dbErr.details,
          payload: Object.keys(insertPayload)
        });
        
        // Defensive: If it's a "column not found" error, we throw a clear instruction
        if (dbErr.code === '42703') {
          throw new Error(`Database Schema Mismatch: A required column is missing. Please run the migration script: ${dbErr.message}`);
        }
        throw dbErr;
      }
      docData = data;
    } catch (insertErr: unknown) {
      const errorMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);
      console.error('[DB] Document persistence critical failure:', errorMsg);
      // If DB persistence fails, we still return the text so the user doesn't lose progress,
      // but we warn about the persistence failure.
      return NextResponse.json({
        success: true, // Partial success (extraction worked)
        text: cleanText,
        documentUrl: publicUrl,
        warning: 'Document text was extracted but could not be saved to history. Please check database schema.',
        error: errorMsg
      });
    }

    // 6. AUTO-CREATE CHAT SESSION (Seeded with document intelligence)
    let chatData: { id: string } | null = null;
    if (docData?.id) {
      // Seed initial state from structured data
      const { initializeStateFromDocument } = await import('@/lib/promptRouter');
      const initialState = initializeStateFromDocument((structuredData as unknown as Record<string, unknown>) || {});

      const { data, error: chatErr } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userId,
          document_id: docData.id,
          title: `Deal Intake: ${file.name}`,
          state: initialState
        })
        .select('id')
        .single();

      if (chatErr) {
        console.error('[DB] Chat session creation failed:', chatErr);
      } else {
        chatData = data;
      }
    }

    return NextResponse.json({
      success: true,
      text: cleanText,
      documentUrl: publicUrl,
      documentId: docData?.id || null,
      chatId: chatData?.id || null,
      structured: structuredData,
      metadata: {
        fileName: file.name,
        fileType: SUPPORTED_TYPES[mimeType],
        mimeType,
        fileSize: file.size,
      }
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[PARSE] Unhandled error:', err);
    return NextResponse.json(
      { error: `Document processing failed: ${err.message}` },
      { status: 500 }
    );
  }
}
