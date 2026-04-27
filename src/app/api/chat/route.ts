import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions, chatMessages, mandates, deals } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { 
  processDealIntake, 
  DealData, 
  getMissingFields,
  mergeData
} from '@/lib/ai/deal-engine';

function normalizeArrays(data: DealData) {
  return {
    ...data,
    sectors: Array.isArray(data.sectors) ? data.sectors : [data.sectors].filter(Boolean),
    geographies: Array.isArray(data.geographies) ? data.geographies : [data.geographies].filter(Boolean),
    special_conditions: Array.isArray(data.special_conditions) 
      ? data.special_conditions 
      : data.special_conditions ? [data.special_conditions] : [],
    fraud_flags: Array.isArray(data.fraud_flags) 
      ? data.fraud_flags 
      : data.fraud_flags ? [data.fraud_flags] : []
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const history = await db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, session.user.id),
      orderBy: [desc(chatSessions.createdAt)],
      with: {
        messages: {
          orderBy: [desc(chatMessages.createdAt)],
          limit: 50,
        },
      },
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Chat history fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { message, chatId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Get or Create Session
    let activeChatId = chatId;
    let currentSession;

    if (!activeChatId) {
      const sessionValues = {
        userId: session.user.id,
        title: message.substring(0, 30) + '...',
        sessionData: {},
      };
      
      [currentSession] = await db.insert(chatSessions).values(sessionValues).returning();
      activeChatId = currentSession.id;
    } else {
      currentSession = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, activeChatId),
      });
      if (!currentSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
    }

    // 2. Turn Count for Context
    const messageStats = await db.select({ value: count() })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, activeChatId));
    
    const turnCount = messageStats[0]?.value || 0;

    // 3. Save User Message
    await db.insert(chatMessages).values({
      chatId: activeChatId,
      role: 'user',
      content: message,
    });

    // 4. STEP 1 — EXTRACT DATA FROM LLM
    const previousState = (currentSession.sessionData as Partial<DealData>) || {};
    const extraction = await processDealIntake(message, previousState, turnCount);

    // 5. STEP 2 — MERGE STATE (Backend Responsibility)
    const mergedData = mergeData(previousState, extraction.data);

    // 6. STEP 3 — VALIDATE MISSING FIELDS (CRITICAL BACKEND LOGIC)
    const missingFields = getMissingFields(mergedData);
    console.log("BACKEND VALIDATION - Missing:", missingFields);

    // 7. PERSIST MERGED STATE
    await db.update(chatSessions)
      .set({ sessionData: mergedData })
      .where(eq(chatSessions.id, activeChatId));

    // 8. STEP 4 & 5 — COMPLETION CHECK
    if (missingFields.length > 0) {
      const responseMessage = extraction.message;

      await db.insert(chatMessages).values({
        chatId: activeChatId,
        role: 'assistant',
        content: responseMessage,
      });

      return NextResponse.json({
        type: "clarification",
        message: responseMessage,
        content: responseMessage,
        chatId: activeChatId,
        missing_fields: missingFields,
        data: mergedData
      });
    }

    // 9. STEP 6 — DATABASE INSERT (ONLY WHEN READY)
    try {
      console.log("✅ ALL FIELDS PRESENT. PERMANENT STORAGE INITIATED...");
      const cleanedData = normalizeArrays(mergedData);

      // A. Insert into mandates
      await db.insert(mandates).values({
        userId: session.user.id,
        rawText: message,
        normalisedText: JSON.stringify(cleanedData),
        intent: cleanedData.intent,
        sectors: cleanedData.sectors,
        geographies: cleanedData.geographies,
        dealSizeMinCr: cleanedData.deal_size_min_cr?.toString() || null,
        dealSizeMaxCr: cleanedData.deal_size_max_cr?.toString() || null,
        revenueMinCr: cleanedData.revenue_min_cr?.toString() || null,
        revenueMaxCr: cleanedData.revenue_max_cr?.toString() || null,
        dealStructure: cleanedData.deal_structure,
        specialConditions: cleanedData.special_conditions,
        status: 'ACTIVE',
        source: 'WEB',
      });

      // B. Insert into deals
      await db.insert(deals).values({
        userId: session.user.id,
        title: `${cleanedData.intent}: ${cleanedData.sectors[0]} in ${cleanedData.geographies[0]}`,
        sector: cleanedData.sectors[0],
        region: cleanedData.geographies[0],
        size: cleanedData.deal_size_min_cr ? `${cleanedData.deal_size_min_cr} Cr` : 'TBD',
        status: 'live',
      });

      // 10. STEP 7 — FINAL SUCCESS RESPONSE
      const successMessage = "✅ Message recorded. You'll get matched opportunities soon.";

      await db.insert(chatMessages).values({
        chatId: activeChatId,
        role: 'assistant',
        content: successMessage,
      });

      return NextResponse.json({
        type: "complete",
        message: successMessage,
        content: successMessage,
        chatId: activeChatId,
        data: cleanedData
      });

    } catch (dbError) {
      console.error("CRITICAL DB INSERT FAILURE:", dbError);
      return NextResponse.json({ 
        error: "Failed to save deal to database. Please try again.",
        type: "error"
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Chat processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
