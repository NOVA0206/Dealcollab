import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/utils/supabase/server';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

// Some browsers set MIME type as empty string or octet-stream for .doc/.docx/.ppt/.pptx
// We also validate by file extension as a fallback
const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { field: 'file', message: 'Storage service unavailable. Please contact support.' },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ field: 'file', message: 'No file provided' }, { status: 400 });
    }

    // Validate by MIME type OR extension (some browsers don't report correct MIME types)
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const mimeOk = ACCEPTED_TYPES.includes(file.type);
    const extOk = ACCEPTED_EXTENSIONS.includes(ext);

    if (!mimeOk && !extOk) {
      return NextResponse.json(
        { field: 'file', message: `Only PDF, DOC, DOCX, PPT, PPTX files are accepted. Got type: ${file.type}, ext: ${ext}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ field: 'file', message: 'File must be under 10MB' }, { status: 400 });
    }

    // Use email-based folder path (sanitized) since session.user.id may not match Supabase user id
    const email = session.user.email.trim().toLowerCase();
    const safeFolder = email.replace(/[^a-z0-9]/g, '_');
    const cleanExt = ext.replace('.', '');
    const fileName = `${safeFolder}/${Date.now()}.${cleanExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure the bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'profile-attachments');
    
    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket('profile-attachments', {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ACCEPTED_TYPES,
      });
      if (bucketError) {
        console.error('Bucket creation error:', bucketError);
        // Continue anyway — bucket might exist with different permissions
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('profile-attachments')
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { field: 'file', message: 'Upload failed: ' + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('profile-attachments')
      .getPublicUrl(fileName);

    // Save URL to user profile immediately
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_attachment_url: urlData.publicUrl })
      .ilike('email', email);

    if (updateError) {
      console.error('Profile URL update error:', updateError);
      // Don't fail — the file is uploaded, URL just didn't save to DB
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: file.name,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ field: 'file', message: 'Internal server error' }, { status: 500 });
  }
}
