import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { runSecurityRules, inspectUrlSafety } from '@/lib/rules';
import { combineSecurityLayers } from '@/lib/combine';

export interface GemmaAnalysisResult {
  risk: 'high' | 'medium' | 'low';
  scam_type: string;
  reasons: string[];
  next_steps: string[];
}

export interface UnmaskedUrlData {
  original: string;
  finalUrl: string;
  redirected: boolean;
  domain: string;
  isHttps: boolean;
  riskLevel: 'high' | 'medium' | 'low';
  verdict: string;
}

// Unmask redirects and track where links actually lead
async function traceLinkDestination(rawText: string): Promise<UnmaskedUrlData | null> {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/i;
  const match = rawText.match(urlRegex);
  if (!match) return null;

  const found = match[0];
  let targetUrl = found;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'http://' + targetUrl;
  }

  let finalUrl = targetUrl;
  let redirected = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    if (res.url && res.url !== targetUrl) {
      finalUrl = res.url;
      redirected = true;
    }
  } catch (e) {
    // If request times out or is offline, analyze the domain directly
  }

  const inspection = inspectUrlSafety(finalUrl) || inspectUrlSafety(targetUrl);

  return {
    original: found,
    finalUrl,
    redirected,
    domain: inspection?.domain || finalUrl.split('/')[2] || finalUrl,
    isHttps: finalUrl.toLowerCase().startsWith('https://'),
    riskLevel: inspection?.riskLevel || 'medium',
    verdict: inspection?.verdict || 'Domain reputation assessed.',
  };
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
      ? 'Suspicious Activity'
      : 'Mashkook Message / Activity';

    return {
      risk,
      scam_type: parsed.scam_type || defaultType,
      reasons: Array.isArray(parsed.reasons) && parsed.reasons.length > 0
        ? parsed.reasons
        : [lang === 'urdu' ? 'اس میں مشکوک علامات پائی گئی ہیں' : 'Is message mein mashkook dabao ke ishare hain.'],
      next_steps: Array.isArray(parsed.next_steps) && parsed.next_steps.length > 0
        ? parsed.next_steps
        : [lang === 'urdu' ? 'کوئی او ٹی پی، پاس ورڈ یا رقم مت بھیجیں' : 'Kisi ko OTP ya paise na dein.'],
    };
  } catch (e) {
    return {
      risk: 'medium',
      scam_type: lang === 'urdu' ? 'غیر مصدقہ پیغام' : 'Unverified Content',
      reasons: [lang === 'urdu' ? 'میسج کا تکنیکی جائزہ لیا گیا ہے' : 'Message ka jaiza liya gaya hai.'],
      next_steps: [lang === 'urdu' ? 'ہیلپ لائن سے تصدیق کریں' : 'Pehle helpline se tasdeeq karein.'],
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

    // 1. Trace link destination (unmasks where links actually lead)
    const linkTrace = await traceLinkDestination(message);

    // 2. Run Local Security Rules Layer
    const rulesResult = runSecurityRules(message);

    // If linkTrace found dangerous final URL, elevate rules
    if (linkTrace && linkTrace.riskLevel === 'high') {
      rulesResult.overallRisk = 'high';
      rulesResult.triggered = true;
      rulesResult.violations.push({
        category: 'url',
        severity: 'high',
        message: `Link destination leads to dangerous domain (${linkTrace.domain})`,
        matched: linkTrace.finalUrl,
      });
    }

    // 3. Call Google Gemma 4
    const apiKey = process.env.GEMINI_API_KEY;
    let gemmaResult: GemmaAnalysisResult;
    let rawText = '';
    let fallbackTriggered = false;

    if (!apiKey) {
      fallbackTriggered = true;
      gemmaResult = {
        risk: rulesResult.overallRisk,
        scam_type: selectedLang === 'urdu' ? 'سیکیورٹی رولز ڈیٹیکشن' : 'Rule-Based Security Detection',
        reasons: [selectedLang === 'urdu' ? 'لوکل سیکیورٹی رولز نے جائزہ لیا' : 'Local security heuristics flagged this content.'],
        next_steps: [selectedLang === 'urdu' ? 'کسی انجان شخص پر بھروسہ نہ کریں' : 'Do not send money or credentials.'],
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
          ? 'This is a transcript from a WhatsApp voice note or phone call intercepted in Pakistan. Focus on fake customer service impersonation, urgency, and OTP/PIN harvesting.'
          : source === 'link' || linkTrace
          ? `This contains a link (${linkTrace ? `Target: ${linkTrace.finalUrl}` : message}). Focus on lookalike brand phishing, fake bank rewards, and credential theft.`
          : 'Analyze this SMS or WhatsApp message for Pakistani cyber fraud, fake prizes, account block threats, and accidental money transfer claims.';

        const systemPrompt = `You are an elite cybersecurity scam detector for people in Pakistan. ${sourceContext} Look for urgency, fear, requests for money or OTP, fake prizes or jobs, impersonation of Easypaisa, JazzCash, banks, NADRA, BISP or FESCO, and suspicious links. Reply ONLY with valid JSON: {"risk":"high|medium|low","scam_type":"...","reasons":[...],"next_steps":[...]}. ${languageInstruction} Never claim a message is 100% safe. If unsure, choose medium.`;

        const prompt = `${systemPrompt}\n\nContent to analyze:\n"""\n${message}\n"""`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        rawText = response.text || '';
        gemmaResult = cleanAndParseJSON(rawText, selectedLang);
      } catch (gemmaErr: any) {
        console.error('Gemma call failed, falling back to Rules Layer:', gemmaErr?.message || 'Unknown error');
        fallbackTriggered = true;
        rawText = `Fallback triggered: ${gemmaErr?.message || 'API error'}`;
        gemmaResult = {
          risk: rulesResult.overallRisk,
          scam_type: selectedLang === 'urdu' ? 'سیکیورٹی ہیورسٹک ڈیٹیکشن' : 'Heuristic Rules Engine',
          reasons: [
            selectedLang === 'urdu'
              ? 'لوکل سیکیورٹی ہیورسٹکس کے ذریعے پیغام کا جائزہ لیا گیا۔'
              : 'Analyzed using Scam Shield Hybrid Engine (AI + Pakistan Fraud Rules).',
          ],
          next_steps: [
            selectedLang === 'urdu'
              ? 'بینک یا ہیلپ لائن سے تصدیق کے بغیر پیسے نہ بھیجیں'
              : 'Do not click links or send funds without verbal confirmation.',
          ],
        };
      }
    }

    // 4. Combine both layers through Hybrid Architecture
    const combineLang = selectedLang === 'urdu' ? 'urdu' : 'roman';
    const combined = combineSecurityLayers(gemmaResult, rulesResult, combineLang);

    return NextResponse.json({
      success: true,
      assessment: combined,
      linkTrace,
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
