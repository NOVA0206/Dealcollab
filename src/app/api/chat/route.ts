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
 * 🎯 PRODUCTION-GRADE CRASH-PROOF API ROUTE
 * Implements: Safe AI handling, Safe JSON parsing, Safe DB inserts.
 */

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

function normalizeArrays(data: Partial<DealData>) {
  return {
    ...data,
    sectors: (Array.isArray(data.sectors) ? data.sectors : [data.sectors].filter(Boolean)) as string[],
    geographies: (Array.isArray(data.geographies) ? data.geographies : [data.geographies].filter(Boolean)) as string[],
    special_conditions: (Array.isArray(data.special_conditions) 
      ? data.special_conditions 
      : data.special_conditions ? [data.special_conditions] : []) as string[],
    fraud_flags: (Array.isArray(data.fraud_flags) 
      ? data.fraud_flags 
      : data.fraud_flags ? [data.fraud_flags] : []) as string[]
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
  // 1. GLOBAL ERROR HANDLER
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { message, chatId } = body;
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // 2. Session & History Logic
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

    // 3. SAFE AI RESPONSE HANDLING
    const previousState = (currentSession.sessionData as Partial<DealData>) || {};
    const groq = new Groq({ apiKey });
    
    console.log("STEP 1: CALLING AI...");
    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Context: Turn ${turnCount + 1}. Data: ${JSON.stringify(previousState)}\nUser: "${message}"` }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    const aiContent = response?.choices?.[0]?.message?.content || null;
    if (!aiContent) throw new Error("AI returned empty response");
    console.log("STEP 1: AI RESPONSE RECEIVED");

    // 4. SAFE JSON PARSING
    let extraction;
    try {
      extraction = JSON.parse(aiContent);
    } catch {
      console.error("JSON PARSE ERROR:", aiContent);
      throw new Error("Invalid AI JSON format");
    }
    console.log("STEP 2: JSON PARSED");

    // 5. Merge & Validate
    const mergedData = mergeData(previousState, extraction.data);
    const missingFields = getMissingFields(mergedData);

    await db.update(chatSessions).set({ sessionData: mergedData }).where(eq(chatSessions.id, activeChatId));

    if (missingFields.length > 0) {
      const responseMessage = extraction.message || "Could you tell me more?";
      await db.insert(chatMessages).values({ chatId: activeChatId, role: 'assistant', content: responseMessage });
      return NextResponse.json({ type: "clarification", message: responseMessage, chatId: activeChatId, missing_fields: missingFields, data: mergedData });
    }

    // 6. SAFE DB INSERT (CRITICAL)
    console.log("STEP 3: ATTEMPTING DB INSERT...");
    try {
      const cleanedData = normalizeArrays(mergedData);

      await db.insert(mandates).values({
        userId: session.user.id,
        rawText: message,
        normalisedText: JSON.stringify(cleanedData),
        intent: cleanedData.intent as string,
        sectors: cleanedData.sectors,
        geographies: cleanedData.geographies,
        dealSizeMinCr: cleanedData.deal_size_min_cr?.toString() || null,
        dealSizeMaxCr: cleanedData.deal_size_max_cr?.toString() || null,
        revenueMinCr: cleanedData.revenue_min_cr?.toString() || null,
        revenueMaxCr: cleanedData.revenue_max_cr?.toString() || null,
        dealStructure: cleanedData.deal_structure,
        specialConditions: cleanedData.special_conditions,
        fraudFlags: cleanedData.fraud_flags,
        status: 'ACTIVE',
        source: 'WEB',
      });

      await db.insert(deals).values({
        userId: session.user.id,
        title: `${cleanedData.intent || 'Deal'}: ${cleanedData.sectors?.[0] || 'Unspecified Sector'} in ${cleanedData.geographies?.[0] || 'Unspecified Region'}`,
        sector: cleanedData.sectors?.[0] || 'General',
        region: cleanedData.geographies?.[0] || 'Global',
        size: cleanedData.deal_size_min_cr ? `${cleanedData.deal_size_min_cr} Cr` : 'TBD',
        status: 'live',
      });

      console.log("STEP 3: DB INSERT SUCCESSFUL");

      const successMessage = "✅ Message recorded. You'll get matched opportunities soon.";
      await db.insert(chatMessages).values({ chatId: activeChatId, role: 'assistant', content: successMessage });

      return NextResponse.json({ type: "complete", message: successMessage, chatId: activeChatId, data: cleanedData });

    } catch (dbError) {
      console.error("DB INSERT ERROR:", dbError);
      throw new Error("Failed to persist deal data to database.");
    }

  } catch (error: unknown) {
    // 7. FINAL ERROR HANDLER (NO CRASH)
    const err = error as Error;
    console.error("🔥 FINAL ERROR:", err);
    return NextResponse.json({
      type: "error",
      message: err.message || "An unexpected error occurred during processing."
    }, { status: 500 });
  }
}
