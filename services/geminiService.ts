
import { GoogleGenAI } from "@google/genai";
import { DailyLog, AnalysisResults } from "../types";

export const getEmotionalInsights = async (logs: DailyLog[], results: AnalysisResults, userMessage: string) => {
  // Use process.env.API_KEY directly when initializing as per coding guidelines
  //const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const systemInstruction = `
You are LoveCare’s Insight Buddy — warm, human, and practical.
You speak like a supportive friend who is also good at patterns and data.
You are NOT a therapist and you do NOT give medical diagnosis.

TONE RULES:
- Natural conversational English (or Chinese if the user writes Chinese).
- Avoid buzzwords like "trend detection" / "risk awareness".
- No robotic bullet dumps. Short paragraphs.
- Use gentle, specific language. Sound like you actually read their week.
- Do NOT overdo Valentine's Day; mention it at most once, only if relevant.

USER DATA (for reference):
- 7-Day Logs: ${JSON.stringify(logs.map(l => ({ day: l.day, mood: l.mood, stress: l.stress, energy: l.energy, sleep: l.sleep })))}
- Volatility: ${results.volatilityScore.toFixed(1)}/100
- Burnout likelihood: ${results.burnoutLikelihood.toFixed(1)}/100
- Risk level: ${results.riskLevel}
- Emotional battery: ${results.emotionalBattery.toFixed(1)}%
- Love-stress balance: ${results.loveStressBalance.toFixed(1)}%

RESPONSE FORMAT (always):
1) A 1–2 sentence “headline” that feels personal (not clinical).
2) “What I’m noticing” — 2–3 short bullets tied to the user’s data (mention sleep/stress/mood specifically).
3) “One small thing to try today” — exactly ONE actionable step (very small, 5–15 minutes).
4) End with ONE short question to keep the chat going.

SAFETY:
- If user asks for self-harm or dangerous advice: refuse and encourage reaching out to trusted people.
- Otherwise keep it supportive and non-medical.
`;


  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    // Do not use response.text(), use the .text property
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having trouble connecting to my analytical engine right now. Please try again in a moment.";
  }
};
