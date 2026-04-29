import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET() {
  console.log("ENV CHECK (HISTORY):", !!process.env.GROQ_API_KEY);
  
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, session.user.id),
      orderBy: [desc(chatSessions.createdAt)],
    });

    // Return exactly what the PRD/Request asked for
    return NextResponse.json(history.map(s => ({
      id: s.id,
      title: s.title,
      created_at: s.createdAt
    })));

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
