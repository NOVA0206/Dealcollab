import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions, chatMessages, mandates, deals } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { 
  processDealIntake, 
  DealData, 
  getMissingFields, 
  generateQuestions,
  REQUIRED_FIELDS,
  isMissing
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

    // 2. Save User Message
    await db.insert(chatMessages).values({
      chatId: activeChatId,
      role: 'user',
      content: message,
    });

    // 3. Process with AI Engine
    // ALWAYS load previous data from session
    const previousData = (currentSession.sessionData as Partial<DealData>) || {};
    const engineResponse = await processDealIntake(message, previousData);

    const mergedData = engineResponse.data;

    // 🚨 STEP 7 — PREVENT RE-ASK (Compute missing on MERGED data)
    const missingFields = REQUIRED_FIELDS.filter(field => isMissing(mergedData[field as keyof DealData]));
    
    // 🚨 DEBUG LOGS (As requested)
    // "Extracted" is already logged inside deal-engine.ts, but we keep the flow clear here
    console.log("Merged:", mergedData);
    console.log("Missing:", missingFields);

    // 4. Update Session Memory (CRITICAL: PERSIST BACK TO DB)
    await db.update(chatSessions)
      .set({ sessionData: mergedData })
      .where(eq(chatSessions.id, activeChatId));

    if (missingFields.length > 0) {
      console.log("❌ BLOCKING INSERT — Missing:", missingFields);

      const questions = generateQuestions(missingFields).slice(0, 3);
      const responseContent = questions.join(' ');

      // Save Assistant Response to History
      await db.insert(chatMessages).values({
        chatId: activeChatId,
        role: 'assistant',
        content: responseContent,
      });

      return NextResponse.json({
        type: "clarification",
        missing_fields: missingFields,
        questions: questions,
        content: responseContent,
        chatId: activeChatId
      });
    }

    // 5. DB INSERT (ONLY IF COMPLETE)
    console.log("✅ Data complete. Inserting...");
    
    // Normalize Arrays before Insert
    const cleanedData = normalizeArrays(mergedData);
    console.log("FINAL INSERT DATA:", cleanedData);

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
      fraudFlags: cleanedData.fraud_flags,
      urgency: cleanedData.inferred_urgency,
      buyerType: cleanedData.inferred_buyer_type,
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

    const successMessage = "✅ Deal recorded successfully. All 11 data points captured.";

    // Save Assistant Response to History
    await db.insert(chatMessages).values({
      chatId: activeChatId,
      role: 'assistant',
      content: successMessage,
    });

    return NextResponse.json({
      type: "success",
      message: successMessage,
      content: successMessage,
      chatId: activeChatId,
      data: cleanedData
    });

  } catch (error) {
    console.error('Chat processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
