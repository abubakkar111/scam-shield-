'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  Send,
  Sparkles,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Lock,
  Upload,
  Image as ImageIcon,
  FileText,
  Activity,
  Cpu,
  Mic,
  MicOff,
  Link as LinkIcon,
  Volume2,
  Copy,
  Check,
  Radio,
  FileWarning,
  ExternalLink,
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { inspectUrlSafety, UrlInspectionResult } from '@/lib/rules';
import { generateFiaComplaint } from '@/lib/complaint';

interface CombinedAssessment {
  finalRisk: 'high' | 'medium' | 'low';
  scamType: string;
  reasons: string[];
  nextSteps: string[];
  layerBreakdown: {
    gemmaVerdict: 'high' | 'medium' | 'low';
    gemmaHighlights: string[];
    rulesVerdict: 'high' | 'medium' | 'low';
    rulesTriggered: boolean;
    rulesHighlights: string[];
  };
  threatScore: number;
}

export default function Home() {
  // 3-Way Language Selector
  const [lang, setLang] = useState<'english' | 'roman' | 'urdu'>('roman');

  // Input Mode (Text, Link Shield, Voice Call/Note, Screenshot OCR)
  const [inputMode, setInputMode] = useState<'text' | 'link' | 'voice' | 'screenshot'>('text');

  // Input Content
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result Assessment
  const [assessment, setAssessment] = useState<CombinedAssessment | null>(null);
  const [urlInspection, setUrlInspection] = useState<UrlInspectionResult | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [copiedComplaint, setCopiedComplaint] = useState(false);

  // Screenshot OCR States
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Recording / Live Audio States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<any>(null);

  // Simulated Live Threat Ticker across Pakistani Cities
  const threatFeeds = [
    { city: 'Faisalabad', text: 'Fake BISP Rs. 25,000 disbursement phishing link blocked (bisp-claim.xyz)' },
    { city: 'Lahore', text: 'Accidental Easypaisa reversal scam intercepted (Rs. 45,000 claim)' },
    { city: 'Karachi', text: 'Job from home task deposit fraud flagged on WhatsApp' },
    { city: 'Rawalpindi', text: 'Fake FESCO bill payment 30% discount phishing URL neutralized' },
    { city: 'Islamabad', text: 'Genuine HBL 2FA OTP transaction verified clean' },
  ];
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % threatFeeds.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Timer for voice recording
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Handle URL Pre-Inspection in Real-Time
  useEffect(() => {
    if (message.includes('http://') || message.includes('https://') || message.includes('.com') || message.includes('.xyz') || message.includes('.top') || message.includes('.click')) {
      const inspected = inspectUrlSafety(message);
      setUrlInspection(inspected);
    } else {
      setUrlInspection(null);
    }
  }, [message]);

  // Speech Recognition (Microphone Fake Call / Voice Note Scanner)
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        lang === 'urdu'
          ? 'آپ کا براؤزر مائیک اسپیچ ریکگنیشن کو سپورٹ نہیں کرتا۔ برائے مہربانی نیچے دیے گئے سیمپل کال بٹن استعمال کریں۔'
          : 'Your browser does not support SpeechRecognition. Please use the preset call simulator below.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang === 'urdu' ? 'ur-PK' : 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error('Mic error:', e);
      setIsRecording(false);
      setError('Microphone access denied or error occurred.');
    }
  };

  // OCR Processing for Screenshot upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    setOcrLoading(true);
    setOcrProgress(20);
    setError(null);

    try {
      const worker = await createWorker('eng');
      setOcrProgress(50);
      const ret = await worker.recognize(file);
      setOcrProgress(90);
      await worker.terminate();

      const extractedText = ret.data.text.trim();
      if (!extractedText) {
        throw new Error('Image se text extract nahi ho saka. Baraye meharbani saaf tasweer dein.');
      }

      setMessage(extractedText);
      setOcrProgress(100);
      setInputMode('text');
    } catch (ocrErr: any) {
      console.error('OCR Error:', ocrErr);
      setError(ocrErr.message || 'Screenshot se text parhne mein masla aaya.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Run Hybrid Security Analysis
  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setAssessment(null);
    setRawOutput(null);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          lang,
          source: inputMode === 'voice' ? 'audio' : inputMode === 'link' ? 'link' : 'text',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error occurred');
      }

      setAssessment(data.assessment);
      setRawOutput(data.raw);
      setFallbackActive(!!data.fallbackTriggered);
    } catch (err: any) {
      setError(err.message || 'Masla pesh aaya. Dobara check karein.');
    } finally {
      setLoading(false);
    }
  };

  // Text-to-Speech Voice Warning
  const handleSpeakVerdict = () => {
    if (!assessment || typeof window === 'undefined' || !window.speechSynthesis) return;

    let textToSpeak = '';
    if (lang === 'urdu') {
      textToSpeak = assessment.finalRisk === 'high'
        ? `خبردار! یہ پیغام یا کال انتہائی خطرناک ہے اور فراڈ لگتا ہے۔ کسی کو بھی او ٹی پی، پاس ورڈ یا رقم واپس نہ بھیجیں۔`
        : `احتیاط کریں۔ اس میں مشکوک علامات ہیں، تصدیق کے بغیر کوئی عمل نہ کریں۔`;
    } else if (lang === 'english') {
      textToSpeak = assessment.finalRisk === 'high'
        ? `Warning! High risk social engineering scam detected. Do not click links, send money, or share OTPs.`
        : `Caution! Suspicious indicators found. Verify with official helpline before acting.`;
    } else {
      textToSpeak = assessment.finalRisk === 'high'
        ? `Alert! Bohat khatarnak message ya call hai. Yeh fraud lagta hai. Kisi ko OTP ya paise wapis na dein.`
        : `Ehtiyat karein. Is mein mashkook pehlu hain. Pehle official helpline se tasdeeq karein.`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Copy FIA / Bank Complaint
  const handleCopyComplaint = () => {
    const draft = generateFiaComplaint(
      {
        incidentId: `PK-SOC-${Math.floor(100000 + Math.random() * 900000)}`,
        timestamp: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
        senderInfo: 'Suspicious Channel / Intercepted Payload',
        scamType: assessment?.scamType || 'Cyber Fraud & Social Engineering Attempt',
        threatLevel: assessment?.finalRisk || 'high',
        messageContent: message.trim(),
        evidencePoints: assessment?.reasons || ['Urgency and psychological manipulation detected by Google Gemma 4.'],
      },
      lang === 'urdu' ? 'urdu' : 'roman'
    );

    navigator.clipboard.writeText(draft);
    setCopiedComplaint(true);
    setTimeout(() => setCopiedComplaint(false), 2000);
  };

  // Language Dictionary for Clean UI
  const t = {
    english: {
      heroTitle: 'Scam Shield Pakistan',
      heroSubtitle: 'Instant cyber fraud, fake call, and phishing link detection using Google Gemma 4 AI.',
      tabText: 'Text / SMS',
      tabLink: 'Pre-Click Link Shield',
      tabVoice: 'Fake Call / Voice Note',
      tabScreenshot: 'Screenshot (OCR)',
      placeholderText: 'Paste suspicious SMS, WhatsApp message, or email here...',
      placeholderLink: 'Paste suspicious link (e.g. http://easypaisa-reward.xyz/login) to inspect BEFORE opening...',
      placeholderVoice: 'Click microphone to record a suspicious call or voice note, or choose a simulated Pakistani scam call below...',
      checkBtn: 'Inspect & Verify',
      checkingBtn: 'Gemma 4 is Analyzing...',
      highRisk: 'High Risk Threat Detected',
      medRisk: 'Caution / Suspicious Activity',
      lowRisk: 'No Obvious Threats Detected',
      highDesc: 'High probability of financial fraud, credential harvesting, or social engineering.',
      medDesc: 'Suspicious attributes detected. Do not click or send funds without verbal helpline confirmation.',
      lowDesc: 'No immediate red flags detected, but remain cautious.',
      listenBtn: '🔊 Listen Aloud',
      copyComplaint: '📋 Copy FIA Complaint',
      reasonsTitle: 'Threat Indicators Detected:',
      stepsTitle: 'Immediate Protective Actions:',
      disclaimer: '⚠️ Educational security guidance, not a definitive legal determination.',
    },
    roman: {
      heroTitle: 'Scam Shield Pakistan',
      heroSubtitle: 'Easypaisa, JazzCash, fake bank calls, aur phishing links ki Gemma 4 AI se fori jaanch.',
      tabText: 'Text / SMS',
      tabLink: 'Pre-Click Link Shield',
      tabVoice: 'Fake Call / Voice Note',
      tabScreenshot: 'Screenshot (OCR)',
      placeholderText: 'Mashkook SMS, WhatsApp message ya link yahan paste karein...',
      placeholderLink: 'Kholne se pehle mashkook link yahan paste karein (e.g. http://easypaisa-cash.xyz)...',
      placeholderVoice: 'Mic button daba kar mashkook phone call ya voice note record karein, ya neeche se sample chunein...',
      checkBtn: 'Check Message (Jaanchein)',
      checkingBtn: 'Gemma 4 Jaanch Raha Hai...',
      highRisk: 'Bohat Khatarnak (High Risk)',
      medRisk: 'Ehtiyat Karein (Medium Risk)',
      lowRisk: 'Koi Wazeh Khatra Nahi Mila',
      highDesc: 'Is message ya call mein 90%+ fraud ya raqam churanay ke qawi asarat hain.',
      medDesc: 'Kuch mashkook nishaniyan mili hain. Baghair tasdeeq koi amal na karein.',
      lowDesc: 'Message mein fori scam signs nahi mile, lekin hamesha hoshiyar rahein.',
      listenBtn: '🔊 Suniye (Listen)',
      copyComplaint: '📋 Copy FIA Complaint',
      reasonsTitle: 'Khatray Ki Wajuhat (Why Flagged):',
      stepsTitle: 'Agle Hifazati Iqdamat (Next Steps):',
      disclaimer: '⚠️ Yeh madad hai, final faisla nahi. / This is guidance, not a guarantee.',
    },
    urdu: {
      heroTitle: 'اسکیم شیلڈ پاکستان',
      heroSubtitle: 'ایزی پیسہ، جاز کیش، جعلی کالز اور مشکوک لنکس کی گُوگل جیما 4 کے ذریعے فوری جانچ۔',
      tabText: 'پیغام / میسج',
      tabLink: 'مشکوک لنک شیلڈ',
      tabVoice: 'جعلی کال / وائس نوٹ',
      tabScreenshot: 'اسکرین شاٹ (OCR)',
      placeholderText: 'مشکوک ایس ایم ایس یا واٹس ایپ پیغام یہاں درج کریں...',
      placeholderLink: 'کلک کرنے سے پہلے مشکوک لنک یہاں پیسٹ کریں (مثال: http://bisp-claim.xyz)...',
      placeholderVoice: 'مائیکروفون پر کلک کر کے مشکوک کال یا وائس نوٹ بولیں یا نیچے سے سیمپل کال منتخب کریں...',
      checkBtn: 'فوری جانچ کریں (Verify)',
      checkingBtn: 'جیما 4 جائزہ لے رہا ہے...',
      highRisk: 'انتہائی خطرناک (ہائی رسک)',
      medRisk: 'احتیاط برتیں (درمیانہ خطرہ)',
      lowRisk: 'کوئی واضح خطرہ نہیں ملا',
      highDesc: 'اس پیغام یا کال میں مالی فراڈ یا ذاتی معلومات چرانے کے ٹھوس شواہد موجود ہیں۔',
      medDesc: 'کچھ مشکوک علامات پائی گئی ہیں۔ ہیلپ لائن کی تصدیق کے بغیر کوئی عمل نہ کریں۔',
      lowDesc: 'کوئی فوری خطرہ ظاہر نہیں ہوا، مگر ہمیشہ محتاط رہیں۔',
      listenBtn: '🔊 سنیں (صوتی انتباہ)',
      copyComplaint: '📋 ایف آئی اے شکایت کاپی کریں',
      reasonsTitle: 'خطرے کی وجوہات (شواہد):',
      stepsTitle: 'حفاظتی اقدامات (کیا کریں):',
      disclaimer: '⚠️ یہ سیکیورٹی رہنمائی کے لیے ہے، حتمی قانونی فیصلہ نہیں۔',
    },
  }[lang];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center selection:bg-emerald-500 selection:text-slate-950 pb-16 font-sans">
      {/* Live Threat Ticker */}
      <div className="w-full bg-slate-900 border-b border-slate-800 py-1.5 px-4 text-xs font-mono">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-400 shrink-0">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-[11px]">Live Threat Shield:</span>
          </div>
          <div className="flex-1 truncate text-slate-300">
            <span className="text-emerald-300 font-semibold">[{threatFeeds[tickerIndex].city}]</span>{' '}
            <span>{threatFeeds[tickerIndex].text}</span>
          </div>
          <span className="hidden sm:inline text-[11px] text-slate-500">
            Gemma 4 (26B-A4B-IT) Active
          </span>
        </div>
      </div>

      {/* Top Header & 3-Way Language Switcher */}
      <header className="w-full max-w-4xl px-4 pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-black text-white tracking-tight ${lang === 'urdu' ? 'font-serif' : ''}`}>
              {t.heroTitle}
            </h1>
            <p className={`text-xs text-slate-400 ${lang === 'urdu' ? 'font-serif' : ''}`}>
              {t.heroSubtitle}
            </p>
          </div>
        </div>

        {/* 3-Way Language Toggle */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setLang('english')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              lang === 'english' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('roman')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              lang === 'roman' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Roman Urdu
          </button>
          <button
            type="button"
            onClick={() => setLang('urdu')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              lang === 'urdu' ? 'bg-emerald-500 text-slate-950 shadow-sm font-serif' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            اردو
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-4xl px-4 space-y-5">
        {/* Unified 4-Mode Input Switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setInputMode('text')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              inputMode === 'text'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t.tabText}</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('link')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              inputMode === 'link'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>{t.tabLink}</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('voice')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              inputMode === 'voice'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span className="flex items-center gap-1">
              <span>{t.tabVoice}</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('screenshot')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              inputMode === 'screenshot'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>{t.tabScreenshot}</span>
          </button>
        </div>

        {/* Input Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-4">
          {/* Pre-Click Live Link Warning Banner (Appears whenever a URL is typed or scanned) */}
          {urlInspection && (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all ${
                urlInspection.riskLevel === 'high'
                  ? 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                  : urlInspection.riskLevel === 'medium'
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                  : 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold uppercase tracking-wider">Pre-Click Link Shield:</span>
                    <span className="font-bold underline">{urlInspection.domain}</span>
                    {!urlInspection.isHttps && <span className="text-rose-400 font-bold">[INSECURE HTTP]</span>}
                  </div>
                  <p className="mt-1 text-slate-200">{urlInspection.verdict}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase font-mono tracking-wider shrink-0 ${
                  urlInspection.riskLevel === 'high'
                    ? 'bg-rose-500 text-white'
                    : urlInspection.riskLevel === 'medium'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {urlInspection.riskLevel === 'high' ? 'DO NOT CLICK' : 'CAUTION'}
              </span>
            </div>
          )}

          {/* MODE: Text / Link / Voice Input Box */}
          {inputMode !== 'screenshot' ? (
            <form onSubmit={handleCheck} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="content-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    {inputMode === 'link' ? t.tabLink : inputMode === 'voice' ? t.tabVoice : t.tabText}
                  </label>
                  {message && (
                    <button
                      type="button"
                      onClick={() => setMessage('')}
                      className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    id="content-input"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      inputMode === 'link'
                        ? t.placeholderLink
                        : inputMode === 'voice'
                        ? t.placeholderVoice
                        : t.placeholderText
                    }
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`w-full p-4 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-transparent text-sm sm:text-base transition-all resize-y leading-relaxed ${
                      lang === 'urdu' ? 'font-serif' : 'font-sans'
                    }`}
                    required
                  />

                  {/* Mic button floating inside textarea for Voice Mode */}
                  {inputMode === 'voice' && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      {isRecording && (
                        <span className="text-xs text-rose-400 font-mono flex items-center gap-1.5 animate-pulse bg-rose-950/60 px-2 py-1 rounded-md border border-rose-500/30">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>Listening: {recordingSeconds}s</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className={`p-2.5 rounded-full shadow-lg transition-all cursor-pointer ${
                          isRecording
                            ? 'bg-rose-500 text-white animate-bounce'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                        }`}
                      >
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Voice Mode Quick Call Simulator Buttons (Stage Demo Magic) */}
              {inputMode === 'voice' && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <span className="font-bold text-slate-300 font-mono flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    Stage Demo: 1-Click Fake Pakistani Voice Call Presets:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(
                          'Asalam-o-Alaikum, main JazzCash head office Islamabad se bol raha hoon. Aapka account biometric expiry ki waja se block hone laga hai. Aapke mobile par abhi 4 digit ka OTP aya hai, fori batayein taakay account unblock ho sakay.'
                        );
                      }}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-left border border-slate-800 hover:border-slate-700 text-slate-300 space-y-1 transition-all"
                    >
                      <div className="font-semibold text-rose-300">📞 Fake JazzCash Voice Call</div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 font-mono">
                        "Main head office se bol raha hoon, OTP share karein..."
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMessage(
                          'Bhai khuda ke waste paise wapis bhej dein. Meri ammi hospital mein dakhil hain, ghalti se 30,000 aapke Easypaisa account par bhej diye hain. Khuda aapka bhala karega wapis bhej dein.'
                        );
                      }}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-left border border-slate-800 hover:border-slate-700 text-slate-300 space-y-1 transition-all"
                    >
                      <div className="font-semibold text-amber-300">🎙️ Accidental Transfer Voice Note</div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 font-mono">
                        "Ghalti se 30,000 bhej diye hain wapis kar dein..."
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  Gemma 4 AI (`gemma-4-26b-a4b-it`) + Rules
                </span>

                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:cursor-not-allowed text-sm"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.checkingBtn}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{t.checkBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* MODE: Screenshot OCR */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/80 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/60 hover:bg-slate-900/60 space-y-3"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Upload SMS or WhatsApp Screenshot
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    On-device OCR extracts the text directly into the inspection engine.
                  </p>
                </div>
              </div>

              {ocrLoading && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-2 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      Extracting text from image...
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{ocrProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {imagePreview && (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <img
                    src={imagePreview}
                    alt="Uploaded screenshot"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-700"
                  />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-200">Screenshot Loaded</p>
                    <p className="text-slate-400">
                      Text extracted. Click the Text tab above to inspect with Gemma 4!
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3 Quick Example Buttons */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessage('0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein apka bhala hoga.');
                  setInputMode('text');
                }}
                className="p-2.5 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs space-y-1 group transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 group-hover:text-emerald-400">Easypaisa Scam</span>
                  <span className="text-[10px] text-rose-400 font-mono">🔴 Scam</span>
                </div>
                <p className="text-slate-400 line-clamp-1 text-[11px] font-mono">0300 se 25,000 ghalti se bhej diye...</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMessage('Benazir Income Support: 25,000 wazifa manzoor hua. Link par register karein: http://bisp-wazifa-claim.xyz/verify');
                  setInputMode('link');
                }}
                className="p-2.5 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs space-y-1 group transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 group-hover:text-emerald-400">Fake BISP Link</span>
                  <span className="text-[10px] text-amber-400 font-mono">🟡 Phishing</span>
                </div>
                <p className="text-slate-400 line-clamp-1 text-[11px] font-mono">bisp-wazifa-claim.xyz/verify</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMessage('HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP with anyone.');
                  setInputMode('text');
                }}
                className="p-2.5 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs space-y-1 group transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 group-hover:text-emerald-400">Genuine Bank OTP</span>
                  <span className="text-[10px] text-emerald-400 font-mono">🟢 Clean</span>
                </div>
                <p className="text-slate-400 line-clamp-1 text-[11px] font-mono">HBL Alert: Your OTP is 591823...</p>
              </button>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Alert</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Fallback Banner */}
        {fallbackActive && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Local Fail-Safe:</strong> Evaluated via deterministic rules because AI network connection was unavailable.
            </span>
          </div>
        )}

        {/* Streamlined Result Card */}
        {assessment && (
          <section
            className={`border rounded-2xl p-5 sm:p-7 transition-all space-y-5 shadow-2xl backdrop-blur-md ${
              assessment.finalRisk === 'high'
                ? 'bg-rose-950/30 border-rose-500/60'
                : assessment.finalRisk === 'medium'
                ? 'bg-amber-950/30 border-amber-500/60'
                : 'bg-emerald-950/30 border-emerald-500/60'
            }`}
          >
            {/* Verdict Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
              <div className="flex items-center gap-3.5">
                {assessment.finalRisk === 'high' ? (
                  <ShieldAlert className="w-9 h-9 text-rose-400 shrink-0" />
                ) : assessment.finalRisk === 'medium' ? (
                  <AlertTriangle className="w-9 h-9 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-9 h-9 text-emerald-400 shrink-0" />
                )}

                <div>
                  <h2
                    className={`text-xl sm:text-2xl font-black tracking-tight ${
                      assessment.finalRisk === 'high'
                        ? 'text-rose-400'
                        : assessment.finalRisk === 'medium'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    } ${lang === 'urdu' ? 'font-serif' : ''}`}
                  >
                    {assessment.finalRisk === 'high'
                      ? t.highRisk
                      : assessment.finalRisk === 'medium'
                      ? t.medRisk
                      : t.lowRisk}
                  </h2>
                  <p className={`text-xs sm:text-sm text-slate-300 mt-0.5 ${lang === 'urdu' ? 'font-serif' : ''}`}>
                    {assessment.finalRisk === 'high'
                      ? t.highDesc
                      : assessment.finalRisk === 'medium'
                      ? t.medDesc
                      : t.lowDesc}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Listen Aloud & Copy Complaint */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSpeakVerdict}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t.listenBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyComplaint}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedComplaint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedComplaint ? 'Copied!' : t.copyComplaint}</span>
                </button>
              </div>
            </div>

            {/* Classification & Threat Meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">Category: {assessment.scamType}</span>
                <span className="text-slate-400">Threat Severity: {assessment.threatScore}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    assessment.finalRisk === 'high'
                      ? 'bg-rose-500'
                      : assessment.finalRisk === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${assessment.threatScore}%` }}
                />
              </div>
            </div>

            {/* Reasons List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>{t.reasonsTitle}</span>
              </h3>
              <ul className="space-y-2">
                {assessment.reasons.map((r, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-slate-900/70 p-3 rounded-xl border border-slate-800 ${
                      lang === 'urdu' ? 'font-serif text-sm' : ''
                    }`}
                  >
                    <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Steps List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t.stepsTitle}</span>
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {assessment.nextSteps.map((s, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-slate-900/70 p-3 rounded-xl border border-slate-800 ${
                      lang === 'urdu' ? 'font-serif' : ''
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Deep Dive (Collapsible for Judges) */}
            {rawOutput && (
              <div className="pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowRaw(!showRaw)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1.5 transition-colors font-mono"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Inspect Gemma 4 Raw Inferences & Payload (Judges Proof)
                  </span>
                  {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showRaw && (
                  <pre className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {rawOutput}
                  </pre>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Footer Disclaimer */}
      <footer className="mt-12 text-center text-xs text-slate-500 max-w-xl px-4 space-y-1 font-mono">
        <p className={lang === 'urdu' ? 'font-serif' : ''}>{t.disclaimer}</p>
        <p className="text-[11px] text-slate-600">
          Scam Shield Pakistan • Google Gemma 4 (26B-A4B-IT) • Apache 2.0 • MIT Open Source
        </p>
      </footer>
    </main>
  );
}
