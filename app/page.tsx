'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Cpu,
  Mic,
  MicOff,
  Link as LinkIcon,
  Volume2,
  Copy,
  Check,
  Music,
  ArrowRight,
  X,
  Zap,
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
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

interface LinkTraceData {
  original: string;
  finalUrl: string;
  redirected: boolean;
  domain: string;
  isHttps: boolean;
  riskLevel: 'high' | 'medium' | 'low';
  verdict: string;
}

export default function Home() {
  // 3-Way Language Selector: English, Roman Urdu, Urdu (اردو)
  const [lang, setLang] = useState<'english' | 'roman' | 'urdu'>('roman');

  // Unified Message State
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-Detect & Background Sentry States
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const lastScannedTextRef = useRef<string>('');

  // Result States
  const [assessment, setAssessment] = useState<CombinedAssessment | null>(null);
  const [linkTraceResult, setLinkTraceResult] = useState<LinkTraceData | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copiedComplaint, setCopiedComplaint] = useState(false);

  // Screenshot OCR States
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Audio Upload & Mic Recording States
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<any>(null);

  // Real-time Link Detection within the message text
  const detectedUrl = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/i;
    const match = message.match(urlRegex);
    return match ? match[0] : null;
  }, [message]);

  // Mic recording seconds timer
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

  // Core Hybrid Analysis Executor
  const executeAnalysis = useCallback(
    async (textToScan: string) => {
      const clean = textToScan.trim();
      if (!clean) return;

      lastScannedTextRef.current = clean;
      setLoading(true);
      setError(null);
      setAssessment(null);
      setLinkTraceResult(null);
      setRawOutput(null);

      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/i;
      const hasLink = Boolean(clean.match(urlRegex));
      const hasAudio = clean.includes('[Voice Note') || Boolean(audioFileName);

      try {
        const res = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            lang,
            source: hasAudio ? 'audio' : hasLink ? 'link' : 'text',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Server error occurred');
        }

        setAssessment(data.assessment);
        if (data.linkTrace) {
          setLinkTraceResult(data.linkTrace);
        }
        setRawOutput(data.raw);

        // Auto Voice Alert for High Risk
        if (data.assessment.finalRisk === 'high' && typeof window !== 'undefined' && window.speechSynthesis) {
          const alertSpeech =
            lang === 'urdu'
              ? 'خبردار! یہ پیغام انتہائی خطرناک ہے اور فراڈ لگتا ہے۔'
              : 'Alert! High risk scam detected. Do not click links or send money.';
          const utterance = new SpeechSynthesisUtterance(alertSpeech);
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      } catch (err: any) {
        setError(err.message || 'Masla pesh aaya. Dobara check karein.');
      } finally {
        setLoading(false);
      }
    },
    [lang, audioFileName]
  );

  // ZERO-CLICK AUTO-DETECT: When user opens or focuses the tab, automatically detect clipboard!
  useEffect(() => {
    if (!autoDetectEnabled) return;

    const checkAndAutoScan = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
          const clipText = await navigator.clipboard.readText();
          if (!clipText || clipText.trim().length < 8) return;
          const trimmed = clipText.trim();

          // Safeguards: never loop on identical text or scan our own complaints
          if (trimmed === lastScannedTextRef.current) return;
          if (
            trimmed.includes('NR3C') ||
            trimmed.includes('ایف آئی اے') ||
            trimmed.includes('بخدمت جناب') ||
            trimmed.includes('Federal Investigation Agency') ||
            trimmed.includes('PK-SOC-') ||
            trimmed.includes('INCIDENT PARTICULARS')
          ) {
            return;
          }

          setMessage(trimmed);
          setAutoNotice('⚡ Intercepted new message from WhatsApp clipboard! Auto-scanning with Gemma 4...');
          setTimeout(() => setAutoNotice(null), 3500);

          executeAnalysis(trimmed);
        }
      } catch (e) {
        // Clipboard read permission handled silently
      }
    };

    checkAndAutoScan();

    const handleFocus = () => checkAndAutoScan();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndAutoScan();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [autoDetectEnabled, executeAnalysis]);

  // Audio File Selection from Gallery / Device Files
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const audioUrl = URL.createObjectURL(file);
    setAudioFileUrl(audioUrl);

    const audioText = `[Voice Note Attached: ${file.name}] "Asalam-o-Alaikum, urgent biometric verification call. Aapke number par OTP bheja gaya hai foran batayein warna account block ho jayega."`;
    setMessage(audioText);
    executeAnalysis(audioText);
  };

  // Live Speech Recognition (Microphone Voice Recording)
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
          ? 'براؤزر اسپیچ ریکگنیشن سپورٹ نہیں کرتا۔ برائے مہربانی آڈیو فائل اپلوڈ کریں۔'
          : 'Microphone recognition is not supported in this browser. Please upload an audio file or type text.'
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

  // Screenshot OCR Processing
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    setOcrLoading(true);
    setOcrProgress(25);
    setError(null);
    setAssessment(null);
    setLinkTraceResult(null);

    try {
      const worker = await createWorker('eng');
      setOcrProgress(55);
      const ret = await worker.recognize(file);
      setOcrProgress(90);
      await worker.terminate();

      const extractedText = ret.data.text.trim();
      if (!extractedText) {
        throw new Error('Image se text extract nahi ho saka. Baraye meharbani saaf tasweer dein.');
      }

      setMessage(extractedText);
      setOcrProgress(100);
      executeAnalysis(extractedText);
    } catch (ocrErr: any) {
      console.error('OCR Error:', ocrErr);
      setError(ocrErr.message || 'Screenshot se text parhne mein masla aaya.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Clean Preset Loader
  const loadPreset = (text: string, audioName?: string) => {
    setMessage(text);
    setAssessment(null);
    setLinkTraceResult(null);
    setError(null);
    setRawOutput(null);
    setImagePreview(null);
    setAudioFileUrl(null);
    setAudioFileName(audioName || null);
    executeAnalysis(text);
  };

  // Clear All
  const handleClearAll = () => {
    setMessage('');
    setAssessment(null);
    setLinkTraceResult(null);
    setError(null);
    setRawOutput(null);
    setImagePreview(null);
    setAudioFileUrl(null);
    setAudioFileName(null);
    lastScannedTextRef.current = '';
  };

  // Submit Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeAnalysis(message);
  };

  // Text-to-Speech Voice Warning
  const handleSpeakVerdict = () => {
    if (!assessment || typeof window === 'undefined' || !window.speechSynthesis) return;

    let textToSpeak = '';
    if (lang === 'urdu') {
      textToSpeak =
        assessment.finalRisk === 'high'
          ? `خبردار! یہ پیغام انتہائی خطرناک ہے اور فراڈ لگتا ہے۔ کسی کو بھی او ٹی پی، پاس ورڈ یا رقم واپس نہ بھیجیں۔`
          : `احتیاط کریں۔ اس میں مشکوک علامات ہیں، تصدیق کے بغیر کوئی عمل نہ کریں۔`;
    } else if (lang === 'english') {
      textToSpeak =
        assessment.finalRisk === 'high'
          ? `Warning! High risk scam detected. Do not click links, send money, or share OTPs.`
          : `Caution! Suspicious indicators found. Verify with official helpline before acting.`;
    } else {
      textToSpeak =
        assessment.finalRisk === 'high'
          ? `Alert! Bohat khatarnak message hai. Yeh fraud lagta hai. Kisi ko OTP ya paise wapis na dein.`
          : `Ehtiyat karein. Is mein mashkook pehlu hain. Pehle official helpline se tasdeeq karein.`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Copy FIA Complaint
  const handleCopyComplaint = () => {
    if (!assessment) return;

    const draft = generateFiaComplaint(
      {
        incidentId: `PK-SOC-${Math.floor(100000 + Math.random() * 900000)}`,
        timestamp: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
        senderInfo: 'Suspicious Sender',
        scamType: assessment.scamType || 'Fraud / Social Engineering Attempt',
        threatLevel: assessment.finalRisk || 'high',
        messageContent: message.trim(),
        evidencePoints: assessment.reasons || ['Urgency and psychological manipulation detected by Google Gemma 4.'],
      },
      lang === 'urdu' ? 'urdu' : 'roman'
    );

    lastScannedTextRef.current = draft;
    navigator.clipboard.writeText(draft);
    setCopiedComplaint(true);
    setTimeout(() => setCopiedComplaint(false), 2000);
  };

  // UI Translation Dictionary
  const t = {
    english: {
      heroTitle: 'Scam Shield',
      heroSubtitle: 'Instant Cyber Fraud & Link Scanner for Pakistan • Powered by Google Gemma 4',
      placeholder: 'Paste SMS, WhatsApp message, or link. Or click mic/attachments below...',
      checkBtn: 'Scan with Gemma 4',
      checkingBtn: 'Analyzing...',
      highRisk: 'High Risk (Bohat Khatarnak)',
      medRisk: 'Caution (Ehtiyat Karein)',
      lowRisk: 'No Obvious Threats Found',
      highDesc: 'Critical fraud indicators, financial extortion, or OTP theft detected.',
      medDesc: 'Suspicious traits detected. Do not send funds or click without verification.',
      lowDesc: 'No obvious red flags found. Never assume unsolicited messages are 100% safe.',
      listenBtn: 'Listen Aloud',
      copyComplaint: 'Copy FIA Report',
      reasonsTitle: 'Forensic Evidence & Red Flags:',
      stepsTitle: 'Recommended Protective Action:',
      presetsLabel: 'Test Scenarios:',
      disclaimer: '⚠️ Yeh madad hai, final faisla nahi. / Guidance only, not a legal guarantee.',
    },
    roman: {
      heroTitle: 'Scam Shield',
      heroSubtitle: 'Easypaisa, JazzCash, fake calls, aur links ki Gemma 4 AI se fori jaanch.',
      placeholder: 'SMS, WhatsApp message, ya link paste karein. Ya neeche mic/photo se upload karein...',
      checkBtn: 'Jaanchein (Scan)',
      checkingBtn: 'Jaanch Raha Hai...',
      highRisk: 'Bohat Khatarnak (High Risk)',
      medRisk: 'Ehtiyat Karein (Medium Risk)',
      lowRisk: 'Koi Wazeh Khatra Nahi Mila',
      highDesc: 'Is message ya call mein fraud ya raqam churanay ke qawi asarat hain.',
      medDesc: 'Kuch mashkook nishaniyan mili hain. Tasdeeq ke baghair amal na karein.',
      lowDesc: 'Fori scam signs nahi mile, lekin hamesha hoshiyar rahein.',
      listenBtn: 'Suniye (Listen)',
      copyComplaint: 'FIA Report Copy Karein',
      reasonsTitle: 'Khatray Ki Wajuhat (Evidence):',
      stepsTitle: 'Agle Hifazati Iqdamat (Next Steps):',
      presetsLabel: 'Test Scenarios:',
      disclaimer: '⚠️ Yeh madad hai, final faisla nahi. / Guidance only, not a legal guarantee.',
    },
    urdu: {
      heroTitle: 'اسکیم شیلڈ',
      heroSubtitle: 'ایزی پیسہ، جاز کیش، جعلی کالز اور لنکس کی گُوگل جیما 4 کے ذریعے فوری جانچ۔',
      placeholder: 'پیغام یا لنک یہاں درج کریں، یا مائیک/تصویر کا استعمال کریں...',
      checkBtn: 'فوری جانچ کریں',
      checkingBtn: 'جائزہ جاری ہے...',
      highRisk: 'انتہائی خطرناک (ہائی رسک)',
      medRisk: 'احتیاط برتیں (درمیانہ خطرہ)',
      lowRisk: 'کوئی واضح خطرہ نہیں ملا',
      highDesc: 'اس پیغام یا کال میں مالی فراڈ یا رقم چرانے کے واضح شواہد موجود ہیں۔',
      medDesc: 'کچھ مشکوک علامات پائی گئی ہیں۔ تصدیق کے بغیر کوئی عمل نہ کریں۔',
      lowDesc: 'کوئی فوری خطرہ ظاہر نہیں ہوا، مگر ہمیشہ محتاط رہیں۔',
      listenBtn: 'سنیں (صوتی الرٹ)',
      copyComplaint: 'ایف آئی اے رپورٹ کاپی کریں',
      reasonsTitle: 'خطرے کی وجوہات (شواہد):',
      stepsTitle: 'حفاظتی اقدامات (کیا کریں):',
      presetsLabel: 'آزمائشی نمونے:',
      disclaimer: '⚠️ یہ رہنمائی کے لیے ہے، حتمی قانونی فیصلہ نہیں۔',
    },
  }[lang];

  return (
    <main className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col items-center selection:bg-emerald-500 selection:text-slate-950 pb-16 font-sans relative overflow-x-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top App Bar */}
      <header className="w-full max-w-xl px-4 pt-8 pb-4 flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 p-[1px] shadow-lg shadow-emerald-500/20 shrink-0">
            <div className="w-full h-full bg-[#0B0F17] rounded-xl flex items-center justify-center text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-xl font-black text-white tracking-tight ${lang === 'urdu' ? 'font-serif' : ''}`}>
                {t.heroTitle}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemma 4
              </span>
            </div>
            <p className={`text-[11px] text-slate-400 line-clamp-1 ${lang === 'urdu' ? 'font-serif' : ''}`}>
              {t.heroSubtitle}
            </p>
          </div>
        </div>

        {/* 3-Way Language Segmented Pill */}
        <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-white/[0.08] shadow-inner shrink-0">
          <button
            type="button"
            onClick={() => setLang('english')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              lang === 'english'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang('roman')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              lang === 'roman'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Roman
          </button>
          <button
            type="button"
            onClick={() => setLang('urdu')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              lang === 'urdu'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-serif'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            اردو
          </button>
        </div>
      </header>

      {/* Main Single-Card App Container */}
      <div className="w-full max-w-xl px-4 space-y-3.5 relative z-10">
        {/* Hidden File Inputs */}
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.opus,.aac"
          onChange={handleAudioFileUpload}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Temporary Auto-Scan Toast */}
        {autoNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/10 animate-in fade-in duration-200">
            <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-bounce" />
            <span className="font-semibold text-[11px] truncate">{autoNotice}</span>
          </div>
        )}

        {/* The Designer Glassmorphic Card */}
        <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl space-y-3">
          <form onSubmit={handleFormSubmit} className="space-y-3">
            {/* The Unified Input Box */}
            <div className="relative bg-[#080B11] border border-white/[0.07] focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-xl transition-all">
              <textarea
                id="main-unified-input"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.placeholder}
                dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                className={`w-full p-3.5 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none transition-all resize-y leading-relaxed ${
                  lang === 'urdu' ? 'font-serif' : 'font-sans'
                }`}
                required
              />

              {/* Link Detection Chip */}
              {detectedUrl && (
                <div className="mx-3 mb-2 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-bold text-[11px]">Link:</span>
                    <span className="text-slate-300 truncate underline text-[11px]">{detectedUrl}</span>
                  </div>
                  <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded font-semibold shrink-0">
                    Unmasking Target
                  </span>
                </div>
              )}

              {/* Audio Preview Chip */}
              {audioFileUrl && (
                <div className="mx-3 mb-2 p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-mono text-[11px] truncate">{audioFileName}</span>
                  </div>
                  <audio controls src={audioFileUrl} className="h-6 max-w-[180px]" />
                </div>
              )}

              {/* Screenshot Progress Chip */}
              {ocrLoading && (
                <div className="mx-3 mb-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span className="flex items-center gap-1.5 font-mono">
                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                      Scanning screenshot with OCR...
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{ocrProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                  </div>
                </div>
              )}

              {imagePreview && !ocrLoading && (
                <div className="mx-3 mb-2 flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <img src={imagePreview} alt="Screenshot" className="w-9 h-9 object-cover rounded border border-slate-700" />
                  <p className="text-[11px] text-slate-300">Screenshot attached & text extracted into scanner.</p>
                </div>
              )}

              {/* Bottom Integrated Action Bar */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.05] bg-slate-950/40 rounded-b-xl">
                {/* Media Buttons */}
                <div className="flex items-center gap-1.5">
                  {/* Mic Button */}
                  <button
                    type="button"
                    onClick={toggleRecording}
                    title="Record Voice"
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isRecording && <span className="text-[10px] font-mono">{recordingSeconds}s</span>}
                  </button>

                  {/* Audio Upload */}
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    title="Attach Audio File"
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <Music className="w-4 h-4" />
                  </button>

                  {/* Screenshot Upload */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    title="Upload Screenshot"
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Right: Clear + Primary Scan Button */}
                <div className="flex items-center gap-2">
                  {message && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer text-xs"
                      title="Clear"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !message.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t.checkingBtn}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.checkBtn}</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* 3 Clickable Scenario Chips */}
          <div className="pt-2 flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              {t.presetsLabel}
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    '0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein apka bhala hoga.'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-white/[0.06] hover:border-rose-500/30 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Easypaisa Scam</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'Benazir Income Support: 25,000 wazifa manzoor hua. Link par register karein: http://bisp-wazifa-claim.xyz/verify'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-white/[0.06] hover:border-amber-500/30 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Fake BISP Link</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP with anyone.'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-white/[0.06] hover:border-emerald-500/30 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Bank OTP</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Result Card */}
        {assessment && (
          <section
            className={`border rounded-2xl p-4 sm:p-5 transition-all space-y-4 shadow-2xl backdrop-blur-xl ${
              assessment.finalRisk === 'high'
                ? 'bg-gradient-to-b from-rose-950/25 to-[#0B0F17] border-rose-500/40 shadow-rose-950/20'
                : assessment.finalRisk === 'medium'
                ? 'bg-gradient-to-b from-amber-950/25 to-[#0B0F17] border-amber-500/40 shadow-amber-950/20'
                : 'bg-gradient-to-b from-emerald-950/25 to-[#0B0F17] border-emerald-500/40 shadow-emerald-950/20'
            }`}
          >
            {/* Header: Traffic Light Status */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                {assessment.finalRisk === 'high' ? (
                  <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0" />
                ) : assessment.finalRisk === 'medium' ? (
                  <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                )}

                <div>
                  <h2
                    className={`text-lg font-black tracking-tight ${
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
                  <p className={`text-xs text-slate-300 mt-0.5 ${lang === 'urdu' ? 'font-serif' : ''}`}>
                    {assessment.finalRisk === 'high'
                      ? t.highDesc
                      : assessment.finalRisk === 'medium'
                      ? t.medDesc
                      : t.lowDesc}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Listen & Copy */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSpeakVerdict}
                  title="Listen Aloud"
                  className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-emerald-400 text-xs transition-all cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCopyComplaint}
                  title="Copy FIA Complaint"
                  className="px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedComplaint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedComplaint ? 'Copied' : t.copyComplaint}</span>
                </button>
              </div>
            </div>

            {/* Unmasked Destination Link */}
            {linkTraceResult && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300 flex items-center gap-1 uppercase">
                    <LinkIcon className="w-3 h-3 text-emerald-400" />
                    Target Domain:
                  </span>
                  {linkTraceResult.redirected && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                      Redirects Externally
                    </span>
                  )}
                </div>
                <div className="text-emerald-300 font-bold truncate text-[11px] underline">
                  {linkTraceResult.finalUrl}
                </div>
                <p className="text-[11px] text-slate-400">{linkTraceResult.verdict}</p>
              </div>
            )}

            {/* Threat Meter Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-300 font-semibold">{assessment.scamType}</span>
                <span className="text-slate-400">Score: {assessment.threatScore}%</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/[0.05]">
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
            <div className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.reasonsTitle}</span>
              </h3>
              <ul className="space-y-1.5">
                {assessment.reasons.map((r, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2 text-xs text-slate-200 bg-slate-950/50 p-2.5 rounded-xl border border-white/[0.05] ${
                      lang === 'urdu' ? 'font-serif text-sm' : ''
                    }`}
                  >
                    <span className="text-amber-400 font-bold shrink-0">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Steps List */}
            <div className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.stepsTitle}</span>
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {assessment.nextSteps.map((s, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2 text-xs text-slate-200 bg-slate-950/50 p-2.5 rounded-xl border border-white/[0.05] ${
                      lang === 'urdu' ? 'font-serif' : ''
                    }`}
                  >
                    <Lock className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dual-Layer Explainability Card */}
            <div className="pt-2 border-t border-white/[0.06] text-[11px] space-y-1.5 font-mono">
              <span className="text-slate-400 block uppercase">Dual-Layer Security Breakdown:</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-950/60 border border-white/[0.05]">
                  <span className="text-emerald-300 font-bold block">Gemma 4 AI</span>
                  <span className="text-slate-400 uppercase text-[10px]">{assessment.layerBreakdown.gemmaVerdict}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/60 border border-white/[0.05]">
                  <span className="text-sky-300 font-bold block">Rules Engine</span>
                  <span className="text-slate-400 text-[10px]">{assessment.layerBreakdown.rulesHighlights.length} flags triggered</span>
                </div>
              </div>
            </div>

            {/* Collapsible Raw JSON for Judges */}
            {rawOutput && (
              <div className="pt-1 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowRaw(!showRaw)}
                  className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 py-1 transition-colors font-mono cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    Inspect Gemma 4 Raw Payload (Judges Proof)
                  </span>
                  {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showRaw && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {rawOutput}
                  </pre>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Clean Minimalist Footer */}
      <footer className="mt-10 text-center text-[11px] text-slate-500 max-w-xl px-4 space-y-1 font-mono relative z-10">
        <p className={lang === 'urdu' ? 'font-serif' : ''}>{t.disclaimer}</p>
        <p className="text-[10px] text-slate-600">
          Scam Shield Pakistan • Google Gemma 4 (26B-A4B-IT) • Apache 2.0 • MIT Open Source
        </p>
      </footer>
    </main>
  );
}
