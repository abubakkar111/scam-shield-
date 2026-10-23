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

function cleanAndParseJSON(raw: string, lang: 'english' | 'roman' | 'urdu'): GemmaAnalysisResult {
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

    const defaultType = lang === 'urdu'
      ? 'مشکوک سرگرمی'
      : lang === 'english'
      ? 'Suspicious Social Engineering'
      : 'Mashkook Message / Activity';

    const defaultReasons = lang === 'urdu'
      ? ['اس پیغام یا کال میں مالی فراڈ کے مشکوک اشارے پائے گئے ہیں']
      : lang === 'english'
      ? ['Urgency or suspicious credential requests detected.']
      : ['Is message ya call mein mashkook dabao ke ishare hain.'];

    const defaultSteps = lang === 'urdu'
      ? ['کوئی ذاتی معلومات، او ٹی پی یا رقم مت بھیجیں']
      : lang === 'english'
      ? ['Do not share OTP, PIN, or transfer funds.']
      : ['Kisi ko OTP, PIN ya paise wapis na dein.'];

    return {
      risk,
      scam_type: parsed.scam_type || defaultType,
      reasons: Array.isArray(parsed.reasons) && parsed.reasons.length > 0 ? parsed.reasons : defaultReasons,
      next_steps: Array.isArray(parsed.next_steps) && parsed.next_steps.length > 0 ? parsed.next_steps : defaultSteps,
    };
  } catch (e) {
    console.error('Failed to parse Gemma output as JSON:', cleaned);
    return {
      risk: 'medium',
      scam_type: lang === 'urdu' ? 'غیر مصدقہ پیغام' : lang === 'english' ? 'Unverified Message' : 'Ghair Tasdeeq Shuda Message',
      reasons: [lang === 'urdu' ? 'پیغام میں مشکوک علامات ہیں' : lang === 'english' ? 'Suspicious indicators detected.' : 'Message ka jaiza liya gaya hai.'],
      next_steps: [lang === 'urdu' ? 'پہلے متعلقہ ادارے سے تصدیق کریں' : lang === 'english' ? 'Verify via official helpline before taking action.' : 'Pehle helpline se tasdeeq karein.'],
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, lang = 'roman', source = 'text' } = body;
    const selectedLang: 'english' | 'roman' | 'urdu' =
      lang === 'urdu' ? 'urdu' : lang === 'english' ? 'english' : 'roman';

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Baraye meharbani message likhein, audio bolain, ya link paste karein.' },
        { status: 400 }
      );
    }

    // 1. Run Local Heuristic Rules Layer
    const rulesResult = runSecurityRules(message);

    // 2. Call Google Gemma 4 through official @google/genai SDK
    const apiKey = process.env.GEMINI_API_KEY;
    let gemmaResult: GemmaAnalysisResult;
    let rawText = '';
    let fallbackTriggered = false;

    if (!apiKey) {
      fallbackTriggered = true;
      gemmaResult = {
        risk: rulesResult.overallRisk,
        scam_type: selectedLang === 'urdu' ? 'سیکیورٹی رولز ڈیٹیکشن' : selectedLang === 'english' ? 'Deterministic Security Rules' : 'Rule-Based Security Detection',
        reasons: [selectedLang === 'urdu' ? 'مقامی سیکیورٹی رولز نے جائزہ لیا' : selectedLang === 'english' ? 'Local security heuristics flagged this message.' : 'Local security heuristics flagged this message.'],
        next_steps: [selectedLang === 'urdu' ? 'کسی انجان شخص پر بھروسہ نہ کریں' : selectedLang === 'english' ? 'Do not send money or credentials.' : 'Do not send money or credentials.'],
      };
    } else {
      try {
        const ai = new GoogleGenAI({ apiKey });

        let languageInstruction = 'Write scam_type, reasons, and next_steps in simple Roman Urdu that ordinary Pakistanis easily understand.';
        if (selectedLang === 'urdu') {
          languageInstruction = 'Write scam_type, reasons, and next_steps in formal, clear Urdu script (اردو رسم الخط).';
        } else if (selectedLang === 'english') {
          languageInstruction = 'Write scam_type, reasons, and next_steps in concise, professional English.';
        }

        const sourceContext = source === 'audio'
          ? 'This is a transcript from a WhatsApp voice note or phone call intercepted in Pakistan. Focus on voice social engineering, fake customer service impersonation, and panic induction.'
          : source === 'link'
          ? 'This is a link inspection. Focus on phishing domains, lookalike banks, credential harvesters, and fake reward claims.'
          : 'Analyze this SMS or WhatsApp message for cyber fraud, fake prizes, account block threats, and accidental money transfer claims.';

        const systemPrompt = `You are an elite cybersecurity scam detector for people in Pakistan. ${sourceContext} Look for urgency, fear, requests for money or OTP, fake prizes or jobs, impersonation of Easypaisa, JazzCash, banks, NADRA, BISP or FESCO, and suspicious links. Reply ONLY with valid JSON: {"risk":"high|medium|low","scam_type":"...","reasons":[...],"next_steps":[...]}. ${languageInstruction} Never claim a message is 100% safe. If unsure, choose medium.`;

        const prompt = `${systemPrompt}\n\nContent to analyze:\n"""\n${message}\n"""`;

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
          scam_type: selectedLang === 'urdu' ? 'سیکیورٹی ہیورسٹک ڈیٹیکشن' : selectedLang === 'english' ? 'Heuristic Security Engine' : 'Heuristic Rules Engine',
          reasons: [
            selectedLang === 'urdu'
              ? 'سرور سے رابطہ عارضی طور پر سست ہے، لوکل سیکیورٹی رولز نے جائزہ لیا'
              : selectedLang === 'english'
              ? 'AI network dropped; local deterministic heuristics evaluated the payload.'
              : 'Gemma 4 was offline; fallback security heuristics analyzed the message.',
          ],
          next_steps: [
            selectedLang === 'urdu'
              ? 'بینک یا ہیلپ لائن سے تصدیق کے بغیر پیسے نہ بھیجیں'
              : selectedLang === 'english'
              ? 'Do not click links or send funds without verbal confirmation.'
              : 'Do not click links or send funds without verbal confirmation.',
          ],
        };
      }
    }

    // 3. Combine both layers through Hybrid Architecture
    const combineLang = selectedLang === 'urdu' ? 'urdu' : 'roman';
    const combined = combineSecurityLayers(gemmaResult, rulesResult, combineLang);

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
