import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: chatId } = await params;

  try {
    // Delete the chat session (cascades to messages in schema)
    await db.delete(chatSessions).where(
      and(
        eq(chatSessions.id, chatId),
        eq(chatSessions.userId, session.user.id)
      )
    );

    return NextResponse.json({ success: true, message: 'Chat deleted' });
  } catch (error) {
    console.error('Chat deletion error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
