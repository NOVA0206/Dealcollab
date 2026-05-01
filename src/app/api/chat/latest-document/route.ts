import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/utils/supabase/server';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");
    
    // Fetch latest document for the user
    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !doc) {
      return NextResponse.json({ success: false, message: 'No document found' });
    }

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      documentUrl: doc.url,
      documentText: doc.extracted_text,
      fileName: doc.name
    });

  } catch (error: unknown) {
    console.error('[LATEST DOC ERROR]:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch document' }, { status: 500 });
  }
}
