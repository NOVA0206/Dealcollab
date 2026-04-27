import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions, chatMessages, mandates, deals } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { 
  DealData, 
  getMissingFields,
  mergeData
} from '@/lib/ai/deal-engine';
import Groq from 'groq-sdk';

/**
 * 🎯 SENIOR ENGINEER FIX: PRODUCTION-GRADE API ROUTE
 * Resolves: Silent failures on Vercel, Runtime mismatch, Env access issues.
 */

// 1. Force Node.js runtime (Edge often lacks standard env access patterns)
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `
You are a deal extraction assistant.
You ONLY extract structured data and suggest next questions.
Return JSON ONLY:
{
  "data": { "intent": "BUY_SIDE" | "SELL_SIDE" | "INVESTMENT" | null, "sectors": [], "geographies": [], "deal_size_min_cr": number | null, "deal_size_max_cr": number | null, "revenue_min_cr": number | null, "revenue_max_cr": number | null, "deal_structure": string | null, "special_conditions": [] },
  "message": "short conversational response"
}
`;

function normalizeArrays(data: DealData) {
  return {
    ...data,
    sectors: Array.isArray(data.sectors) ? data.sectors : [data.sectors].filter(Boolean),
    geographies: Array.isArray(data.geographies) ? data.geographies : [data.geographies].filter(Boolean),
    special_conditions: Array.isArray(data.special_conditions) ? data.special_conditions : data.special_conditions ? [data.special_conditions] : []
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const history = await db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, session.user.id),
      orderBy: [desc(chatSessions.createdAt)],
      with: { messages: { orderBy: [desc(chatMessages.createdAt)], limit: 50 } },
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error('Chat history fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 2. Initialize Groq ONLY inside POST handler (Production Safe)
  const apiKey = process.env.GROQ_API_KEY;
  
  // 3. HARD DEBUG LOGGING
  console.log("🔥 ENV CHECK (GROQ):", !!apiKey);

  if (!apiKey) {
    console.error("❌ CRITICAL: GROQ_API_KEY is missing from environment variables.");
    return NextResponse.json({
      type: "error",
      message: "AI service not configured"
    }, { status: 500 });
  }

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { message, chatId, test } = body;

    // 4. CREATE TEST MODE (Isolates AI vs System issue)
    if (test) {
      console.log("🧪 TEST MODE INITIATED...");
      const groq = new Groq({ apiKey });
      const testResponse = await groq.chat.completions.create({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: "Say 'AI IS ONLINE' if you can read this." }],
      });
      return NextResponse.json({
        type: "test",
        message: testResponse.choices[0]?.message?.content || "No response"
      });
    }

    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // 5. Get Session & History
    let activeChatId = chatId;
    let currentSession;

    if (!activeChatId) {
      [currentSession] = await db.insert(chatSessions).values({
        userId: session.user.id,
        title: message.substring(0, 30) + '...',
        sessionData: {},
      }).returning();
      activeChatId = currentSession.id;
    } else {
      currentSession = await db.query.chatSessions.findFirst({ where: eq(chatSessions.id, activeChatId) });
      if (!currentSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const messageStats = await db.select({ value: count() }).from(chatMessages).where(eq(chatMessages.chatId, activeChatId));
    const turnCount = messageStats[0]?.value || 0;

    await db.insert(chatMessages).values({ chatId: activeChatId, role: 'user', content: message });

    // 6. VERIFY GROQ API CALL
    const previousState = (currentSession.sessionData as Partial<DealData>) || {};
    let extraction;

    try {
      const groq = new Groq({ apiKey });
      console.log("AI: Calling Groq (llama3-8b-8192)...");
      
      const aiResponse = await groq.chat.completions.create({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Turn ${turnCount + 1}. Data: ${JSON.stringify(previousState)}\nUser: "${message}"` }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const raw = aiResponse.choices[0]?.message?.content || "{}";
      extraction = JSON.parse(raw);
      console.log("AI: Successfully extracted data.");

    } catch (error: unknown) {
      // 7. FULL ERROR LOGGING (MANDATORY)
      const err = error as Error;
      console.error("🔥 FULL ERROR:", err);
      console.error("🔥 MESSAGE:", err?.message);
      console.error("🔥 STACK:", err?.stack);

      // 8. FALLBACK ONLY AFTER LOGGING
      const fallbackMsg = "I'm temporarily unable to process AI requests, but I've noted your input. Could you tell me more about your revenue range or deal structure?";
      await db.insert(chatMessages).values({ chatId: activeChatId, role: 'assistant', content: fallbackMsg });

      return NextResponse.json({
        type: "fallback",
        message: fallbackMsg,
        chatId: activeChatId,
        data: previousState
      });
    }

    // 9. Logic continues: Merge, Validate, Store
    const mergedData = mergeData(previousState, extraction.data);
    const missingFields = getMissingFields(mergedData);

    await db.update(chatSessions).set({ sessionData: mergedData }).where(eq(chatSessions.id, activeChatId));

    if (missingFields.length > 0) {
      const responseMessage = extraction.message;
      await db.insert(chatMessages).values({ chatId: activeChatId, role: 'assistant', content: responseMessage });
      return NextResponse.json({ type: "clarification", message: responseMessage, chatId: activeChatId, missing_fields: missingFields, data: mergedData });
    }

    // Completion Path
    const cleanedData = normalizeArrays(mergedData);
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

    await db.insert(deals).values({
      userId: session.user.id,
      title: `${cleanedData.intent}: ${cleanedData.sectors[0]} in ${cleanedData.geographies[0]}`,
      sector: cleanedData.sectors[0],
      region: cleanedData.geographies[0],
      size: cleanedData.deal_size_min_cr ? `${cleanedData.deal_size_min_cr} Cr` : 'TBD',
      status: 'live',
    });

    const successMessage = "✅ Message recorded. You'll get matched opportunities soon.";
    await db.insert(chatMessages).values({ chatId: activeChatId, role: 'assistant', content: successMessage });

    return NextResponse.json({ type: "complete", message: successMessage, chatId: activeChatId, data: cleanedData });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('🔥 CRITICAL SYSTEM ERROR:', err, err.message, err.stack);
    return NextResponse.json({ type: "error", message: "AI processing temporarily unavailable" }, { status: 500 });
  }
}
