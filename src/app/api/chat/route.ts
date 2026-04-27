import Groq from "groq-sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    console.log("🚀 API HIT");

    // 🔥 ENV CHECK
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY missing in production");
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // 🔥 TEST AI CALL (no DB, no parsing)
    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        { role: "user", content: "Say hello properly" }
      ],
    });

    const content = response?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty AI response");
    }

    return NextResponse.json({
      success: true,
      reply: content,
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("🔥 FULL ERROR:", err);
    console.error("🔥 MESSAGE:", err?.message);
    console.error("🔥 STACK:", err?.stack);

    return NextResponse.json({
      success: false,
      error: err?.message || "Unknown error",
    });
  }
}