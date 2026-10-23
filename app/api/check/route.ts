import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

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
          error: 'GEMINI_API_KEY missing hai! Apni .env file mein GEMINI_API_KEY=your_key add karein.',
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

    return NextResponse.json({
      success: true,
      raw: rawText,
    });
  } catch (err: any) {
    console.error('Gemma 4 API error:', err);
    return NextResponse.json(
      {
        error: err?.message || 'Gemma 4 API call mein masla aaya. Check your API key and connection.',
      },
      { status: 500 }
    );
  }
}
