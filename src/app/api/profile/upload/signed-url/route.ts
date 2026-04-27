import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get('file');
  const fileType = searchParams.get('type');

  if (!fileName || !fileType) {
    return NextResponse.json({ error: 'File name and type are required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  const email = session.user.email.trim().toLowerCase();
  const safeFolder = email.replace(/[^a-z0-9]/g, '_');
  const ext = fileName.split('.').pop() || 'pdf';
  const path = `${safeFolder}/${Date.now()}.${ext}`;

  // Create a signed URL for uploading (valid for 5 minutes)
  const { data, error } = await supabase.storage
    .from('profile-attachments')
    .createSignedUploadUrl(path);

  if (error) {
    console.error('Error creating signed upload URL:', error);
    return NextResponse.json({ error: 'Could not generate upload permission' }, { status: 500 });
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    path: path,
    token: data.token // Required for some Supabase client versions
  });
}
