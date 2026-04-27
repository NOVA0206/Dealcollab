import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions, chatMessages, mandates, deals } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import Groq from 'groq-sdk';

/**
 * 🎯 PRODUCTION-READY CHAT SYSTEM (v3.0)
 * Resolves: Vercel deployment issues, Session storage, History fetching.
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `
You are a high-performance Deal Intelligence Assistant.
Your goal is to extract structured deal data from a conversation.

---
# 🎯 CORE PRINCIPLE
DO NOT ask everything at once. Ask ONLY 1-2 missing fields per turn.

---
# ⚙️ EXTRACTION SCHEMA
Return JSON ONLY:
{
  "data": {
    "intent": "BUY_SIDE" | "SELL_SIDE" | "INVESTMENT" | null,
    "sectors": string[],
    "geographies": string[],
    "deal_size_min_cr": number | null,
    "deal_size_max_cr": number | null,
    "deal_structure": string | null,
    "revenue_min_cr": number | null,
    "revenue_max_cr": number | null,
    "special_conditions": string[]
  },
  "is_complete": boolean,
  "message": "a short, smart conversational response asking for missing data"
}

Required for completion (9 fields): intent, sectors, geographies, deal_size_min_cr, deal_size_max_cr, deal_structure, revenue_min_cr, revenue_max_cr, special_conditions.
`;

export async function GET() {
  console.log("FETCHING CHAT HISTORY...");
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const history = await db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, session.user.id),
      orderBy: [desc(chatSessions.createdAt)],
    });

    return NextResponse.json(history);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("🔥 HISTORY FETCH ERROR:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message, 
      stack: err.stack 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 1. PRODUCTION ENV & AUTH CHECK
  console.log("ENV CHECK:", !!process.env.GROQ_API_KEY);
  
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, chatId } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing from environment variables.");
    }

    // 2. SESSION MANAGEMENT
    let activeChatId = chatId;
    if (!activeChatId) {
      const [newSession] = await db.insert(chatSessions).values({
        userId: session.user.id,
        title: message.slice(0, 30) + (message.length > 30 ? "..." : "")
      }).returning();
      activeChatId = newSession.id;
    }

    // 3. PERSIST USER MESSAGE
    await db.insert(chatMessages).values({
      chatId: activeChatId,
      role: 'user',
      content: message,
    });

    // 4. FETCH CONTEXT (Entire history for this session)
    const history = await db.query.chatMessages.findMany({
      where: eq(chatMessages.chatId, activeChatId),
      orderBy: [asc(chatMessages.createdAt)],
    });

    const formattedHistory = history.map(h => ({
      role: h.role as "user" | "assistant" | "system",
      content: h.content
    }));

    // 5. CALL AI (GROQ)
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    console.log("AI: Processing with Groq...");
    const aiResponse = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...formattedHistory
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const aiContent = aiResponse?.choices?.[0]?.message?.content;
    if (!aiContent) throw new Error("AI returned empty response");

    // 6. PARSE & VALIDATE
    let extraction;
    try {
      extraction = JSON.parse(aiContent);
    } catch {
      console.error("JSON PARSE ERROR:", aiContent);
      throw new Error("Invalid AI response format");
    }

    // 7. PERSIST ASSISTANT RESPONSE
    await db.insert(chatMessages).values({
      chatId: activeChatId,
      role: 'assistant',
      content: extraction.message || "I've noted that. What's next?",
    });

    // 8. FINAL COMPLETION LOGIC
    if (extraction.is_complete) {
      console.log("✅ DEAL COMPLETE. PERSISTING TO MANDATES...");
      const d = extraction.data;
      
      await db.insert(mandates).values({
        userId: session.user.id,
        rawText: message,
        normalisedText: JSON.stringify(d),
        intent: d.intent,
        sectors: d.sectors,
        geographies: d.geographies,
        dealSizeMinCr: d.deal_size_min_cr?.toString(),
        dealSizeMaxCr: d.deal_size_max_cr?.toString(),
        revenueMinCr: d.revenue_min_cr?.toString(),
        revenueMaxCr: d.revenue_max_cr?.toString(),
        dealStructure: d.deal_structure,
        specialConditions: d.special_conditions,
        status: 'ACTIVE',
        source: 'WEB',
      });

      await db.insert(deals).values({
        userId: session.user.id,
        title: `${d.intent}: ${d.sectors[0]} in ${d.geographies[0]}`,
        sector: d.sectors[0],
        region: d.geographies[0],
        size: d.deal_size_min_cr ? `${d.deal_size_min_cr} Cr` : 'TBD',
        status: 'live',
      });
    }

    return NextResponse.json({
      success: true,
      message: extraction.message,
      data: extraction.data,
      is_complete: extraction.is_complete,
      chatId: activeChatId
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("🔥 API ERROR:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message, 
      stack: err.stack 
    }, { status: 500 });
  }
}