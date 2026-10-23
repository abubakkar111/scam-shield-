import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { runSecurityRules } from '@/lib/rules';
import { combineSecurityLayers } from '@/lib/combine';

export interface GemmaAnalysisResult {
  risk: 'high' | 'medium' | 'low';
  scam_type: string;
  reasons: string[];
  next_steps: string[];
}

function cleanAndParseJSON(raw: string, lang: 'roman' | 'urdu'): GemmaAnalysisResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    let risk: 'high' | 'medium' | 'low' = 'medium';
    if (parsed.risk && typeof parsed.risk === 'string') {
      const r = parsed.risk.toLowerCase().trim();
      if (r === 'high' || r === 'medium' || r === 'low') {
        risk = r;
      }
    }

    return {
      risk,
      scam_type: parsed.scam_type || (lang === 'urdu' ? 'مشکوک سرگرمی' : 'Mashkook Message'),
      reasons: Array.isArray(parsed.reasons) && parsed.reasons.length > 0
        ? parsed.reasons
        : [lang === 'urdu' ? 'اس میسج میں مشکوک علامات پائی گئی ہیں' : 'Is message mein mashkook dabao ke ishare hain.'],
      next_steps: Array.isArray(parsed.next_steps) && parsed.next_steps.length > 0
        ? parsed.next_steps
        : [lang === 'urdu' ? 'کوئی ذاتی معلومات یا او ٹی پی مت بتائیں' : 'Kisi ko OTP ya PIN na dein.'],
    };
  } catch (e) {
    console.error('Failed to parse Gemma output as JSON:', cleaned);
    return {
      risk: 'medium',
      scam_type: lang === 'urdu' ? 'غیر مصدقہ پیغام' : 'Ghair Tasdeeq Shuda Message',
      reasons: [lang === 'urdu' ? 'پیغام کا تفصیلی جائزہ لیا گیا ہے' : 'Message ka jaiza liya gaya hai.'],
      next_steps: [lang === 'urdu' ? 'احتیاط برتیں اور تصدیق کریں' : 'Ehtiyat karein aur pehle tasdeeq karein.'],
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, lang = 'roman' } = body;
    const selectedLang: 'roman' | 'urdu' = lang === 'urdu' ? 'urdu' : 'roman';

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Baraye meharbani message likhein ya screenshot upload karein.' },
        { status: 400 }
      );
    }

    // 1. Run Heuristic Rules Layer (Zero latency deterministic security check)
    const rulesResult = runSecurityRules(message);

    // 2. Call Gemma 4 through official @google/genai SDK
    const apiKey = process.env.GEMINI_API_KEY;
    let gemmaResult: GemmaAnalysisResult;
    let rawText = '';
    let fallbackTriggered = false;

    if (!apiKey) {
      // Fallback if key missing
      fallbackTriggered = true;
      gemmaResult = {
        risk: rulesResult.overallRisk,
        scam_type: selectedLang === 'urdu' ? 'سیکیورٹی رولز ڈیٹیکشن' : 'Rule-Based Security Detection',
        reasons: [selectedLang === 'urdu' ? 'API کی غیر موجودگی میں لوکل رولز نے جانچ کی ہے' : 'Local security heuristics flagged this message.'],
        next_steps: [selectedLang === 'urdu' ? 'کسی انجان شخص پر بھروسہ نہ کریں' : 'Do not send money or credentials.'],
      };
    } else {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const languageInstruction = selectedLang === 'urdu'
          ? 'Write reasons and next_steps in clear, formal Urdu script (اردو رسم الخط) that an ordinary person understands.'
          : 'Write reasons and next_steps in simple Roman Urdu a non-technical person understands.';

        const systemPrompt = `You are a scam detector for people in Pakistan. Analyze the message. Look for urgency, fear, requests for money or OTP, fake prizes or jobs, impersonation of Easypaisa, JazzCash, banks, NADRA, BISP or FESCO, and suspicious links. Reply ONLY with JSON: {"risk":"high|medium|low","scam_type":"...","reasons":[...],"next_steps":[...]}. ${languageInstruction} Never claim a message is 100% safe. If unsure, choose medium.`;

        const prompt = `${systemPrompt}\n\nMessage to analyze:\n"""\n${message}\n"""`;

        const response = await ai.models.generateContent({
          model: 'gemma-4-26b-a4b-it',
          contents: prompt,
        });

        rawText = response.text || '';
        gemmaResult = cleanAndParseJSON(rawText, selectedLang);
      } catch (gemmaErr: any) {
        console.error('Gemma 4 call failed, falling back to Rules Layer:', gemmaErr);
        fallbackTriggered = true;
        rawText = `Fallback triggered: ${gemmaErr.message || 'API error'}`;
        gemmaResult = {
          risk: rulesResult.overallRisk,
          scam_type: selectedLang === 'urdu' ? 'سیکیورٹی ہیورسٹک ڈیٹیکشن' : 'Heuristic Rules Engine',
          reasons: [
            selectedLang === 'urdu'
              ? 'سرور سے رابطہ عارضی طور پر سست ہے، لوکل سیکیورٹی رولز نے جائزہ لیا'
              : 'Gemma 4 was offline; fallback security heuristics analyzed the message.',
          ],
          next_steps: [
            selectedLang === 'urdu'
              ? 'بینک یا ہیلپ لائن سے تصدیق کے بغیر پیسے نہ بھیجیں'
              : 'Do not click links or send funds without verbal confirmation.',
          ],
        };
      }
    }

    // 3. Combine both layers through Hybrid Architecture
    const combined = combineSecurityLayers(gemmaResult, rulesResult, selectedLang);

    return NextResponse.json({
      success: true,
      assessment: combined,
      rules: rulesResult,
      raw: rawText,
      fallbackTriggered,
      lang: selectedLang,
    });
  } catch (err: any) {
    console.error('Server error in /api/check:', err);
    return NextResponse.json(
      {
        error: err?.message || 'Server error occurred during verification.',
      },
      { status: 500 }
    );
  }
}
