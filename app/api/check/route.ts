import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export interface GemmaAnalysisResult {
  risk: 'high' | 'medium' | 'low';
  scam_type: string;
  reasons: string[];
  next_steps: string[];
}

// Helper to strip markdown code blocks and parse JSON safely
function cleanAndParseJSON(raw: string): GemmaAnalysisResult {
  let cleaned = raw.trim();
  // Remove markdown code fences if present (e.g. ```json ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  // Try to locate JSON object substring if model added any surrounding text
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  const parsed = JSON.parse(cleaned);

  // Normalize risk to valid values
  let risk: 'high' | 'medium' | 'low' = 'medium';
  if (parsed.risk && typeof parsed.risk === 'string') {
    const r = parsed.risk.toLowerCase().trim();
    if (r === 'high' || r === 'medium' || r === 'low') {
      risk = r;
    }
  }

  return {
    risk,
    scam_type: parsed.scam_type || 'Mashkook Message (Suspicious Activity)',
    reasons: Array.isArray(parsed.reasons) && parsed.reasons.length > 0
      ? parsed.reasons
      : ['Is message mein mashkook dabao ya maloomat mangne ke ishare hain.'],
    next_steps: Array.isArray(parsed.next_steps) && parsed.next_steps.length > 0
      ? parsed.next_steps
      : ['Kisi ko OTP ya PIN na dein.', 'Pehle helpline se tasdeeq karein.'],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Baraye meharbani message likhein ya paste karein (Please provide a message).' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'GEMINI_API_KEY missing hai! Apni .env file mein GEMINI_API_KEY add karein.',
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a scam detector for people in Pakistan. Analyze the message. Look for urgency, fear, requests for money or OTP, fake prizes or jobs, impersonation of Easypaisa, JazzCash, banks, NADRA, BISP or FESCO, and suspicious links. Reply ONLY with JSON: {"risk":"high|medium|low","scam_type":"...","reasons":[...],"next_steps":[...]}. Write reasons and next_steps in simple Roman Urdu a non-technical person understands. Never claim a message is 100% safe. If unsure, choose medium.`;

    const prompt = `${systemPrompt}

Message to analyze:
"""
${message}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemma-4-26b-a4b-it',
      contents: prompt,
    });

    const rawText = response.text || '';
    const parsedResult = cleanAndParseJSON(rawText);

    return NextResponse.json({
      success: true,
      result: parsedResult,
      raw: rawText,
    });
  } catch (err: any) {
    console.error('Gemma 4 API error:', err);
    return NextResponse.json(
      {
        error: err?.message || 'Gemma 4 API call mein masla aaya. Check your internet connection.',
      },
      { status: 500 }
    );
  }
}
