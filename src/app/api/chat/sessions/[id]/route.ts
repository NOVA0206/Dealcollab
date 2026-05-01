import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/utils/supabase/server';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chatId = id;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    // Fetch chat session and join with document
    const { data: chat, error } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        document:documents(*)
      `)
      .eq('id', chatId)
      .single();

    if (error || !chat) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...chat
    });

  } catch (error: unknown) {
    console.error('[CHAT DETAIL ERROR]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
