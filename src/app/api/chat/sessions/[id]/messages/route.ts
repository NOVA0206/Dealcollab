import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chatMessages, chatSessions } from '@/db/schema';
import { eq, asc, and } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify session ownership
    const chatSession = await db.query.chatSessions.findFirst({
      where: and(
        eq(chatSessions.id, id),
        eq(chatSessions.userId, session.user.id)
      )
    });

    if (!chatSession) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const messages = await db.query.chatMessages.findMany({
      where: eq(chatMessages.chatId, id),
      orderBy: [asc(chatMessages.createdAt)],
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Messages fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
