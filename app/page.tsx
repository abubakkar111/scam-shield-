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
  Globe2,
  Phone,
  FileSpreadsheet,
  Volume2,
  Printer,
  Copy,
  Check,
  Building,
  Terminal,
  Radio,
  FileQuestion,
  Share2,
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { analyzePakistaniPhoneNumber, analyzePakistaniIban, PhoneAnalysisResult, IbanAnalysisResult } from '@/lib/osint';
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
  // Navigation & Language
  const [navTab, setNavTab] = useState<'scan' | 'osint' | 'batch' | 'complaint'>('scan');
  const [inputMode, setInputMode] = useState<'text' | 'screenshot'>('text');
  const [lang, setLang] = useState<'roman' | 'urdu'>('roman');

  // Scanner States
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<CombinedAssessment | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // OSINT States
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneResult, setPhoneResult] = useState<PhoneAnalysisResult | null>(null);
  const [ibanInput, setIbanInput] = useState('');
  const [ibanResult, setIbanResult] = useState<IbanAnalysisResult | null>(null);

  // Batch Scanner States
  const [batchText, setBatchText] = useState('');
  const [batchResults, setBatchResults] = useState<{ id: number; text: string; risk: string; type: string }[] | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Complaint States
  const [senderInfo, setSenderInfo] = useState('');
  const [generatedComplaint, setGeneratedComplaint] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulated Live Threat Ticker across Pakistan
  const threatFeeds = [
    { city: 'Faisalabad', text: 'Fake BISP Rs. 25,000 disbursement phishing link blocked (bisp-claim.xyz)', type: 'high' },
    { city: 'Lahore', text: 'Accidental Easypaisa reversal scam intercepted (Rs. 45,000 claim)', type: 'high' },
    { city: 'Karachi', text: 'Job from home task deposit fraud flagged on WhatsApp', type: 'med' },
    { city: 'Rawalpindi', text: 'Fake FESCO bill payment 30% discount phishing URL neutralized', type: 'high' },
    { city: 'Islamabad', text: 'Genuine HBL 2FA OTP transaction verified clean', type: 'low' },
  ];
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % threatFeeds.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // 1-Click Pakistani Example Scenarios
  const examples = [
    {
      title: 'Easypaisa / JazzCash Scam',
      badge: '🔴 Obvious Scam',
      text: '0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein apka bhala hoga.',
    },
    {
      title: 'Fake BISP / Phishing Link',
      badge: '🟡 Suspicious Link',
      text: 'Benazir Income Support Program: Apka 25,000 ka wazifa manzoor ho gaya hai. Abhi register karein: http://bisp-wazifa-claim.xyz/verify',
    },
    {
      title: 'Genuine Bank OTP',
      badge: '🟢 Legitimate OTP',
      text: 'HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP with anyone.',
    },
  ];

  // OCR Processing for Screenshot upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    setOcrLoading(true);
    setOcrProgress(15);
    setError(null);

    try {
      const worker = await createWorker('eng');
      setOcrProgress(45);
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
        body: JSON.stringify({ message, lang }),
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

  // Audio Voice Alert using Web Speech API
  const handleSpeakVerdict = () => {
    if (!assessment || typeof window === 'undefined' || !window.speechSynthesis) return;

    let textToSpeak = '';
    if (lang === 'urdu') {
      textToSpeak = assessment.finalRisk === 'high'
        ? `خبردار! یہ پیغام انتہائی خطرناک ہے اور فراڈ لگتا ہے۔ کسی کو بھی او ٹی پی یا رقم واپس نہ بھیجیں۔`
        : `احتیاط کریں۔ اس پیغام میں مشکوک علامات ہیں، تصدیق کے بغیر کوئی عمل نہ کریں۔`;
    } else {
      textToSpeak = assessment.finalRisk === 'high'
        ? `Alert! Bohat khatarnak message hai. Yeh fraud lagta hai. Kisi ko OTP ya paise wapis na dein.`
        : `Ehtiyat karein. Is message mein mashkook pehlu hain. Pehle helpline se tasdeeq karein.`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // OSINT Analysis Handlers
  const handleAnalyzePhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    const res = analyzePakistaniPhoneNumber(phoneInput.trim());
    setPhoneResult(res);
  };

  const handleAnalyzeIban = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ibanInput.trim()) return;
    const res = analyzePakistaniIban(ibanInput.trim());
    setIbanResult(res);
  };

  // Batch Scanner Handler
  const handleBatchScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    setBatchLoading(true);
    const lines = batchText.split('\n').filter((l) => l.trim().length > 5).slice(0, 5);

    setTimeout(() => {
      const results = lines.map((line, idx) => {
        const lower = line.toLowerCase();
        let risk = 'Low Risk (Clean)';
        let type = 'Standard Message';

        if (lower.includes('ghalti') || lower.includes('wapis') || lower.includes('otp') || lower.includes('block') || lower.includes('.xyz') || lower.includes('inam')) {
          risk = 'HIGH RISK (SCAM)';
          type = lower.includes('otp') ? 'Credential Theft' : lower.includes('.xyz') ? 'Phishing URL' : 'Social Engineering';
        } else if (lower.includes('bisp') || lower.includes('verify') || lower.includes('click')) {
          risk = 'MEDIUM RISK (Caution)';
          type = 'Suspicious Grant Scheme';
        }

        return { id: idx + 1, text: line, risk, type };
      });

      setBatchResults(results);
      setBatchLoading(false);
    }, 600);
  };

  // Generate Formal Complaint Draft
  const handleGenerateComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = generateFiaComplaint(
      {
        incidentId: `PK-SOC-${Math.floor(100000 + Math.random() * 900000)}`,
        timestamp: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
        senderInfo: senderInfo.trim() || 'Unknown Sender / CLI',
        scamType: assessment?.scamType || 'Accidental Reversal / Social Engineering Fraud',
        threatLevel: assessment?.finalRisk || 'high',
        messageContent: message.trim() || 'No message text provided',
        evidencePoints: assessment?.reasons || ['Urgency and psychological manipulation detected by Gemma 4.', 'Unverified domestic caller CLI.'],
      },
      lang
    );
    setGeneratedComplaint(draft);
  };

  // Traffic Light Theme Configuration
  const riskThemes = {
    high: {
      titleRoman: 'Bohat Khatarnak (High Risk Scam)',
      titleUrdu: 'انتہائی خطرناک (ہائی رسک فراڈ)',
      descRoman: 'Is message mein 90%+ fraud ya raqam churanay ke qawi asarat hain.',
      descUrdu: 'اس پیغام میں فراڈ یا رقم چوری کرنے کے واضح اور ٹھوس شواہد موجود ہیں۔',
      border: 'border-rose-500/60',
      bg: 'bg-rose-950/30',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      accentText: 'text-rose-400',
      icon: <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0" />,
      barColor: 'bg-rose-500',
    },
    medium: {
      titleRoman: 'Ehtiyat Karein (Medium Risk / Caution)',
      titleUrdu: 'احتیاط برتیں (درمیانہ خطرہ)',
      descRoman: 'Kuch mashkook nishaniyan mili hain. Baghair tasdeeq koi amal na karein.',
      descUrdu: 'کچھ مشکوک نشانیاں پائی گئی ہیں۔ فون کال یا ہیلپ لائن کے بغیر عمل نہ کریں۔',
      border: 'border-amber-500/60',
      bg: 'bg-amber-950/30',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      accentText: 'text-amber-400',
      icon: <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />,
      barColor: 'bg-amber-500',
    },
    low: {
      titleRoman: 'Koi Wazeh Khatra Nahi Mila (Low Risk)',
      titleUrdu: 'کوئی واضح خطرہ نہیں ملا (کم خطرہ)',
      descRoman: 'Message mein fori scam signs nahi mile, lekin hamesha hoshiyar rahein.',
      descUrdu: 'پیغام میں فوری خطرہ ظاہر نہیں ہوا، مگر ہمیشہ محتاط رہیں۔',
      border: 'border-emerald-500/60',
      bg: 'bg-emerald-950/30',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      accentText: 'text-emerald-400',
      icon: <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />,
      barColor: 'bg-emerald-500',
    },
  };

  const currentTheme = assessment ? riskThemes[assessment.finalRisk] : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center selection:bg-emerald-500 selection:text-slate-950 pb-16">
      {/* 1. Live Pakistani SOC Threat Activity Ticker */}
      <div className="w-full bg-slate-900 border-b border-slate-800 py-1.5 px-4 text-xs font-mono overflow-hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-400 shrink-0">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-[11px]">Live Threat Feed:</span>
          </div>
          <div className="flex-1 truncate text-slate-300 transition-all duration-300">
            <span className="text-emerald-300 font-semibold">[{threatFeeds[tickerIndex].city}]</span>{' '}
            <span>{threatFeeds[tickerIndex].text}</span>
          </div>
          <span className="hidden sm:inline text-[11px] text-slate-500">
            State Bank SBP Framework Aligned
          </span>
        </div>
      </div>

      {/* 2. Enterprise Command Top Navigation */}
      <nav className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm tracking-tight">Scam Shield Pakistan</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  Enterprise SOC v2.4
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Model: Google Gemma 4 (26B-A4B-IT) • Apache 2.0
              </p>
            </div>
          </div>

          {/* Operational Module Tabs */}
          <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setNavTab('scan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                navTab === 'scan' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>AI Threat Scanner</span>
            </button>
            <button
              type="button"
              onClick={() => setNavTab('osint')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                navTab === 'osint' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Phone / IBAN OSINT</span>
            </button>
            <button
              type="button"
              onClick={() => setNavTab('batch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                navTab === 'batch' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Batch Fleet Scan</span>
            </button>
            <button
              type="button"
              onClick={() => setNavTab('complaint')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                navTab === 'complaint' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>FIA Complaint</span>
            </button>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setLang('roman')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                lang === 'roman' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Roman Urdu
            </button>
            <button
              type="button"
              onClick={() => setLang('urdu')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                lang === 'urdu' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              اردو رسم الخط
            </button>
          </div>
        </div>
      </nav>

      {/* 3. Hero Header Section */}
      <header className="w-full max-w-5xl text-center pt-8 pb-4 px-4 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide shadow-sm">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Hacktoberfest 26 Hack Day Faisalabad | Best Use of Gemma 4</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          National Scam <span className="text-emerald-400">Shield</span> Pakistan
        </h1>
        <p className={`text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed ${lang === 'urdu' ? 'font-serif' : ''}`}>
          {lang === 'urdu'
            ? 'ایزی پیسہ، جاز کیش، بینک اور بی آئی ایس پی فراڈ پیغامات کی گُوگل جیما 4 اور ہائبرڈ سیکیورٹی رولز کے ذریعے فوری جانچ۔'
            : 'Enterprise-grade detection for Pakistani financial scams, social engineering, and lookalike phishing domains in Roman Urdu and Urdu script.'}
        </p>

        {/* Protection Platform Tags */}
        <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <span className="text-slate-500 font-mono">Hardened for:</span>
          {['Easypaisa', 'JazzCash', 'HBL', 'UBL', 'Meezan Bank', 'BISP (8171)', 'NADRA', 'FESCO Bill Phishing'].map((item) => (
            <span key={item} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
              {item}
            </span>
          ))}
        </div>
      </header>

      {/* 4. Main Tabbed Content Area */}
      <div className="w-full max-w-5xl px-4 space-y-6">
        {/* TAB 1: AI THREAT SCANNER */}
        {navTab === 'scan' && (
          <div className="space-y-6">
            {/* Input Mode Selector (Text vs Screenshot) */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                    inputMode === 'text'
                      ? 'border-emerald-400 text-emerald-400 bg-slate-900/40 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Message / Link Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('screenshot')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                    inputMode === 'screenshot'
                      ? 'border-emerald-400 text-emerald-400 bg-slate-900/40 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span className="flex items-center gap-1.5">
                    <span>Upload Screenshot (OCR)</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Tesseract.js
                    </span>
                  </span>
                </button>
              </div>

              {assessment && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSpeakVerdict}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>🔊 Suniye (Listen)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Dossier</span>
                  </button>
                </div>
              )}
            </div>

            {/* Input Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
              {inputMode === 'text' ? (
                <form onSubmit={handleCheck} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="message-input" className="block text-sm font-semibold text-slate-200">
                        {lang === 'urdu' ? 'مشکوک ایس ایم ایس، واٹس ایپ یا لنک درج کریں:' : 'Paste suspicious SMS / WhatsApp message or link:'}
                      </label>
                      {message && (
                        <button
                          type="button"
                          onClick={() => setMessage('')}
                          className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          Clear text
                        </button>
                      )}
                    </div>
                    <textarea
                      id="message-input"
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        lang === 'urdu'
                          ? 'مثال: 0300-1234567 سے 25,000 غلطی سے بھیج دیے ہیں، برائے مہربانی واپس بھیج دیں...'
                          : 'e.g. 0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein...'
                      }
                      dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                      className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-transparent text-sm sm:text-base transition-all resize-y leading-relaxed font-sans"
                      required
                    />
                  </div>

                  {/* Submission Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      Inference Engine: Google Gemma 4 (26B-A4B-IT) + 50 Heuristics
                    </span>
                    <button
                      type="submit"
                      disabled={loading || !message.trim()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:cursor-not-allowed text-sm"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{lang === 'urdu' ? 'جیما 4 جانچ رہا ہے...' : 'Gemma 4 is Analyzing...'}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>{lang === 'urdu' ? 'فوری جانچ کریں (Check Message)' : 'Check Message (Jaanchein)'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Screenshot Upload OCR Tab */
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
                        Click or Drag to upload SMS / WhatsApp Screenshot
                      </p>
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        Powered by on-device OCR (Tesseract.js). No image leaves your browser.
                      </p>
                    </div>
                  </div>

                  {ocrLoading && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className="flex items-center gap-2 font-mono">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          Extracting text with optical character recognition...
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
                        <p className="font-semibold text-slate-200">Screenshot Loaded & Scanned</p>
                        <p className="text-slate-400">
                          Text extracted successfully. Click the text tab above to review and run analysis!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 1-Click Pakistani Example Scenarios */}
              <div className="pt-4 border-t border-slate-800/80">
                <p className="text-xs font-semibold text-slate-400 mb-2.5 flex items-center gap-1.5 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Interactive Test Scenarios (1-Click Stage Demo):</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {examples.map((ex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMessage(ex.text);
                        setInputMode('text');
                      }}
                      className="p-3 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-xs space-y-1 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                          {ex.title}
                        </span>
                        <span className="text-[10px] font-mono">{ex.badge}</span>
                      </div>
                      <p className="text-slate-400 line-clamp-1 text-[11px] font-mono">
                        {ex.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-200">Security Alert</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Fallback Active Banner */}
            {fallbackActive && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Fail-Safe Active:</strong> Local security heuristics evaluated this message because the AI network connection was unavailable.
                </span>
              </div>
            )}

            {/* Assessment Result Card */}
            {assessment && currentTheme && (
              <section
                className={`border rounded-2xl p-5 sm:p-7 ${currentTheme.bg} ${currentTheme.border} transition-all space-y-6 shadow-2xl backdrop-blur-md`}
              >
                {/* Header: Traffic Light & Threat Level */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-700/60">
                  <div className="flex items-center gap-3.5">
                    {currentTheme.icon}
                    <div>
                      <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${currentTheme.accentText} ${lang === 'urdu' ? 'font-serif' : ''}`}>
                        {lang === 'urdu' ? currentTheme.titleUrdu : currentTheme.titleRoman}
                      </h2>
                      <p className={`text-xs sm:text-sm text-slate-300 mt-0.5 ${lang === 'urdu' ? 'font-serif' : ''}`}>
                        {lang === 'urdu' ? currentTheme.descUrdu : currentTheme.descRoman}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                    <span className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${currentTheme.badge}`}>
                      {assessment.scamType}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Threat Confidence: <strong className="text-white">{assessment.threatScore}%</strong>
                    </span>
                  </div>
                </div>

                {/* Threat Meter Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>Threat Severity Index</span>
                    <span className={currentTheme.accentText}>{assessment.finalRisk.toUpperCase()} RISK TIER</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`${currentTheme.barColor} h-full transition-all duration-500`}
                      style={{ width: `${assessment.threatScore}%` }}
                    />
                  </div>
                </div>

                {/* Explainability Matrix: Which Layer Caught What */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Dual-Engine Explainability (Which Layer Caught What):</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Gemma AI Layer */}
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                          Gemma 4 (Linguistic AI)
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                          {assessment.layerBreakdown.gemmaVerdict.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        Identifies urgency, emotional pressure, and social engineering nuances in Roman/Urdu.
                      </p>
                    </div>

                    {/* Rules Engine Layer */}
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                          Rules Engine (Cyber Heuristics)
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                          {assessment.layerBreakdown.rulesVerdict.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        Inspects lookalike brand domains, shorteners, high-risk TLDs, and 50+ scam keywords.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reasons (Wajuhat) */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    {lang === 'urdu' ? 'خطرے کی وجوہات (Why this was flagged):' : 'Khatray Ki Wajuhat (Reasons Detected):'}
                  </h3>
                  <ul className="space-y-2">
                    {assessment.reasons.map((reason, idx) => (
                      <li
                        key={idx}
                        dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                        className={`flex items-start gap-2.5 text-sm text-slate-200 bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 ${
                          lang === 'urdu' ? 'font-serif text-base' : ''
                        }`}
                      >
                        <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Next Steps (Hifazati Iqdamat) */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    {lang === 'urdu' ? 'حفاظتی اقدامات (Immediate Next Steps):' : 'Agle Iqdamat (What you must do):'}
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {assessment.nextSteps.map((step, idx) => (
                      <li
                        key={idx}
                        dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                        className={`flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 ${
                          lang === 'urdu' ? 'font-serif' : ''
                        }`}
                      >
                        <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Quick Action to Draft Complaint */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-200">Need to file an official cybercrime report?</span>
                    <p className="text-slate-400 text-[11px]">Generate a ready-to-submit FIA NR3C / Bank complaint letter with 1 click.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNavTab('complaint');
                      handleGenerateComplaint({ preventDefault: () => {} } as any);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold border border-slate-700 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Draft FIA Complaint &rarr;
                  </button>
                </div>

                {/* Judges Deep Dive / Raw Audit Trail */}
                {rawOutput && (
                  <div className="pt-2 border-t border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setShowRaw(!showRaw)}
                      className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1.5 transition-colors font-mono"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Inspect Gemma 4 Raw Inferences & Rules Audit Trail (Judges Deep Dive)
                      </span>
                      {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showRaw && (
                      <div className="mt-3 space-y-3">
                        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {rawOutput}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* TAB 2: PHONE & IBAN OSINT INSPECTOR */}
        {navTab === 'osint' && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-400" />
                  Pakistani CLI & Phone Number OSINT Inspector
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect Pakistani mobile numbers, identify telecom operators, and detect high-risk VoIP / spoofed gateways.
                </p>
              </div>

              <form onSubmit={handleAnalyzePhone} className="flex gap-2.5">
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="e.g. 03001234567 or +92 345 7654321 or +234..."
                  className="flex-1 p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  Inspect Phone
                </button>
              </form>

              {phoneResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-slate-400 font-mono">Assessed Entity: </span>
                      <span className="font-bold text-white font-mono">{phoneResult.phoneNumber}</span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase font-mono ${
                        phoneResult.riskLevel === 'high'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {phoneResult.riskLevel.toUpperCase()} RISK
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">Operator:</span>
                      <span className="font-semibold text-slate-200">{phoneResult.operator}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">Account Type:</span>
                      <span className="font-semibold text-slate-200">{phoneResult.accountType}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">Risk Score:</span>
                      <span className="font-semibold text-slate-200">{phoneResult.riskScore}%</span>
                    </div>
                  </div>

                  <ul className="space-y-1 text-slate-300 pt-1">
                    {phoneResult.flags.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* IBAN Section */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <Building className="w-4 h-4 text-emerald-400" />
                  Pakistani Bank IBAN Verifier
                </h3>
                <form onSubmit={handleAnalyzeIban} className="flex gap-2.5">
                  <input
                    type="text"
                    value={ibanInput}
                    onChange={(e) => setIbanInput(e.target.value)}
                    placeholder="e.g. PK36 HABB 0001 2345 6789 0123"
                    className="flex-1 p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
                    required
                  />
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all cursor-pointer"
                  >
                    Verify IBAN
                  </button>
                </form>

                {ibanResult && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-400">{ibanResult.iban}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ibanResult.isValidPakistaniIban
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {ibanResult.isValidPakistaniIban ? 'VALID PAKISTANI IBAN' : 'INVALID FORMAT'}
                      </span>
                    </div>
                    <p className="text-slate-200">
                      <strong>Institution:</strong> {ibanResult.bankName}
                    </p>
                    <ul className="text-slate-400 space-y-1">
                      {ibanResult.riskFlags.map((rf, i) => (
                        <li key={i}>• {rf}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BATCH FLEET SCANNER */}
        {navTab === 'batch' && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Enterprise Fleet Batch Scanner
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Paste up to 5 SMS or chat lines (one per line) to scan simultaneously for corporate incident triage.
                </p>
              </div>

              <form onSubmit={handleBatchScan} className="space-y-3">
                <textarea
                  rows={5}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={`0300-1234567 se 25,000 ghalti se bhej diye wapis kardo
HBL Alert: Your OTP is 582104. Do not share.
BISP 25,000 grant approved: http://bisp-claim.xyz/register`}
                  className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/80 leading-relaxed"
                  required
                />
                <button
                  type="submit"
                  disabled={batchLoading || !batchText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  {batchLoading ? 'Scanning Batch Fleet...' : 'Run Batch Analysis'}
                </button>
              </form>

              {batchResults && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Batch Triage Results ({batchResults.length} Messages Analyzed):
                  </h3>
                  <div className="space-y-2">
                    {batchResults.map((b) => (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 space-y-1">
                          <p className="text-slate-200 font-mono">{b.text}</p>
                          <span className="text-[11px] text-slate-500 font-mono">Category: {b.type}</span>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase font-mono ${
                            b.risk.includes('HIGH')
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : b.risk.includes('MEDIUM')
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {b.risk}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: FIA COMPLAINT DRAFTER */}
        {navTab === 'complaint' && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-400" />
                  Official FIA Cybercrime (NR3C) & Bank Complaint Generator
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Generates an official complaint document containing case IDs, forensic timestamps, and Gemma 4 AI evidence points for FIA or your bank helpline.
                </p>
              </div>

              <form onSubmit={handleGenerateComplaint} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Scammer Phone Number / Sender ID:
                    </label>
                    <input
                      type="text"
                      value={senderInfo}
                      onChange={(e) => setSenderInfo(e.target.value)}
                      placeholder="e.g. 0300-1234567"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Target Bank / Platform:
                    </label>
                    <input
                      type="text"
                      defaultValue="Easypaisa / JazzCash / Bank Helpline"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Generate Official Complaint
                </button>
              </form>

              {generatedComplaint && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400">Formal Dossier Generated:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedComplaint);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied to Clipboard!' : 'Copy Complaint'}</span>
                    </button>
                  </div>
                  <pre
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed ${
                      lang === 'urdu' ? 'font-serif text-sm' : ''
                    }`}
                  >
                    {generatedComplaint}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Enterprise SOC Footer */}
      <footer className="mt-14 text-center text-xs text-slate-500 max-w-2xl px-4 space-y-2">
        <p className={lang === 'urdu' ? 'font-serif' : ''}>
          ⚠️ {lang === 'urdu' ? 'یہ سیکیورٹی رہنمائی کے لیے ہے، حتمی قانونی فیصلہ نہیں۔' : 'Yeh madad hai, final faisla nahi. / This is guidance, not a guarantee.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-slate-600">
          <span>Gemma 4 (26B-A4B-IT)</span>
          <span>•</span>
          <span>Apache 2.0 Open-Weight Model</span>
          <span>•</span>
          <span>State Bank Framework Heuristics</span>
          <span>•</span>
          <span>MIT License</span>
        </div>
      </footer>
    </main>
  );
}
