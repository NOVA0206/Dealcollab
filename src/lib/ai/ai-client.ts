import Groq from "groq-sdk";
import OpenAI from "openai";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Generates an AI response with automatic fallback logic.
 * Primary: Groq (Llama 3)
 * Fallback: OpenAI (GPT-4o)
 * Final Fallback: Static Error JSON
 */
export async function generateAIResponse(messages: ChatMessage[]) {
  try {
    // 🚀 PRIMARY: GROQ (Fast + High Rate Limits)
    console.log("AI: Attempting Groq generation...");
    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama3-70b-8192",
      messages,
      temperature: 0,
      stream: false,
    });

    return response.choices[0]?.message?.content || "";

  } catch (groqError) {
    console.error("Groq generation failed:", groqError);

    // 🔁 FALLBACK: OPENAI (High Reliability)
    if (openai) {
      try {
        console.log("AI: Attempting OpenAI fallback...");
        const response = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o",
          messages,
          temperature: 0,
          stream: false,
        });

        return response.choices[0]?.message?.content || "";

      } catch (openaiError) {
        console.error("OpenAI fallback failed:", openaiError);
      }
    }

    // 🛑 FINAL FALLBACK (ZERO FAILURE GUARANTEE)
    return JSON.stringify({
      type: "error",
      message: "AI processing temporarily unavailable",
      data: {
          intent: null,
          sectors: [],
          geographies: [],
          deal_size_min_cr: null,
          deal_size_max_cr: null,
          revenue_min_cr: null,
          revenue_max_cr: null
      },
      questions: ["I'm having trouble processing that. Could you please rephrase or provide the deal details again?"]
    });
  }
}

/**
 * Utility to clean AI output by removing markdown code blocks.
 */
export function cleanAIJSON(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}
