import { auth } from '@/auth';
import { db } from '@/db';
import { chatMessages, chatSessions, deals, mandates } from '@/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 🎯 HARDENED PRODUCTION CHAT SYSTEM (v4.0)
 * Resolves: Model decommissioning, Vercel build conflicts, silent failures.
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const MODEL = "llama-3.1-8b-instant"; // Primary model
const FALLBACK_MODEL = "mixtral-8x7b-32768"; // Fallback model
const SYSTEM_PROMPT = `
You are a smart, professional Human Deal Advisor. Your goal is to guide the user through a natural conversation to extract deal parameters while feeling like a helpful partner, not a robotic form.

### 🎭 TONE & PERSONALITY
- Professional yet friendly, with a "startup founder" vibe.
- Human-centric: Acknowledge what the user says first ("Got it", "Makes sense", "Solid choice").
- Concise: Keep responses to 1-2 lines maximum.
- Smart: Connect dots naturally instead of asking isolated questions.

### 🎯 CORE CONVERSATION RULES
1. **INTRODUCE & WELCOME**: If the user just says "Hi", "Hello", or is starting a new chat, introduce yourself as their Deal Collab Ai and offer to help them extract deal data for matching.
2. **ACKNOWLEDGE FIRST**: Always validate the user's previous input before moving forward.
3. **NO ROBOTIC Q&A**: Never ask "What is your geography?". Instead, ask "Are you focusing on India or open to global markets too?".
4. **COMBINE QUESTIONS**: Ask for 1-2 related missing fields at once to keep the flow moving.
5. **NO REPETITION**: If the user provided a detail, never ask for it again.
6. **BE THE EXPERT**: Use terms like "majority control", "strategic investment", or "equity play" when appropriate.

### ⚙️ EXTRACTION SCHEMA
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
  "message": "A smart, 1-2 line conversational response."
}

### 🏁 COMPLETION CRITERIA
When all 9 fields are collected, set is_complete: true and use this EXACT message:
"Perfect — got everything I need. I’ll record this and start matching you with relevant opportunities."
`;


export async function GET() {
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
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 1. HARD ENVIRONMENT VALIDATION
  if (!process.env.GROQ_API_KEY) {
    console.error("❌ CRITICAL: Missing GROQ_API_KEY");
    throw new Error("GROQ_API_KEY not found in runtime");
  }
  const apiKey = process.env.GROQ_API_KEY;
  console.log("PRIMARY MODEL:", MODEL);
  console.log("FALLBACK MODEL:", FALLBACK_MODEL);
  console.log("KEY EXISTS:", !!apiKey);

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, chatId } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // 2. SESSION & MESSAGE PERSISTENCE
    let activeChatId = chatId;
    if (!activeChatId) {
      const [newSession] = await db.insert(chatSessions).values({
        userId: session.user.id,
        title: message.slice(0, 30) + (message.length > 30 ? "..." : "")
      }).returning();
      activeChatId = newSession.id;
    }

    await db.insert(chatMessages).values({
      chatId: activeChatId,
      role: 'user',
      content: message,
    });

    const history = await db.query.chatMessages.findMany({
      where: eq(chatMessages.chatId, activeChatId),
      orderBy: [asc(chatMessages.createdAt)],
    });

    const formattedHistory = history.map(h => ({
      role: h.role as "user" | "assistant" | "system",
      content: h.content
    }));

    // 3. GROQ CLIENT INITIALIZATION (INSIDE HANDLER ONLY)
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    // 4. AI CALL WITH RETRY LOGIC
    let aiContent = "";
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      const currentModel = attempts === 0 ? MODEL : FALLBACK_MODEL;
      try {
        console.log(`Using model: ${currentModel} (Attempt ${attempts + 1})`);
        const aiResponse = await groq.chat.completions.create({
          model: currentModel,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...formattedHistory
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        console.log("RAW RESPONSE:", JSON.stringify(aiResponse));
        aiContent = aiResponse?.choices?.[0]?.message?.content || "";

        if (!aiContent) {
          throw new Error("Empty response from Groq");
        }
        break; // Success
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;
        console.warn(`AI: Switching to fallback after error with ${currentModel}:`, (err as Error).message);
        await new Promise(resolve => setTimeout(resolve, 500)); // Short backoff
      }
    }

    // 5. PARSE & VALIDATE
    let extraction;
    try {
      extraction = JSON.parse(aiContent);
    } catch {
      console.error("JSON PARSE ERROR:", aiContent);
      throw new Error("Invalid AI response format");
    }

    // 6. PERSIST ASSISTANT RESPONSE
    await db.insert(chatMessages).values({
      chatId: activeChatId,
      role: 'assistant',
      content: extraction.message || "I've noted that. What's next?",
    });

    // 7. DEAL EXTRACTION LOGIC
    if (extraction.is_complete) {
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

    return Response.json({
      success: true,
      data: aiContent, // Step 8: Explicitly return raw content as 'data'
      message: extraction.message,
      is_complete: extraction.is_complete,
      chatId: activeChatId
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("🔥 REAL ERROR:", err);

    return Response.json({
      success: false,
      error: err.message,
      stack: err.stack
    }, { status: 500 });
  }
}