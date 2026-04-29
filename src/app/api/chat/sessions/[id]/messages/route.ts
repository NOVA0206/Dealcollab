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

    const cleanedMessages = messages.map(m => {
      if (m.role === 'assistant') {
        try {
          const parsed = JSON.parse(m.content);
          return { ...m, content: parsed.message || m.content };
        } catch {
          return m;
        }
      }
      return m;
    });

    return NextResponse.json(cleanedMessages);
  } catch (error: unknown) {
    console.error("FULL ERROR:", error);
    console.error("STRINGIFIED:", JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    return NextResponse.json({ 
      success: false, 
      error: errorMessage, 
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
