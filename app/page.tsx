'use client';

import { useState, useRef } from 'react';
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
  ExternalLink,
  Layers,
  Check,
} from 'lucide-react';
import { createWorker } from 'tesseract.js';

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
  const [activeTab, setActiveTab] = useState<'text' | 'screenshot'>('text');
  const [lang, setLang] = useState<'roman' | 'urdu'>('roman');
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      text: 'HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP or your password with anyone.',
    },
  ];

  // OCR Processing for Screenshot upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show thumbnail preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    setOcrLoading(true);
    setOcrProgress(10);
    setError(null);

    try {
      const worker = await createWorker('eng');
      setOcrProgress(40);
      const ret = await worker.recognize(file);
      setOcrProgress(90);
      await worker.terminate();

      const extractedText = ret.data.text.trim();
      if (!extractedText) {
        throw new Error('Image se koi text nahi mila. Please saaf screenshot upload karein.');
      }

      setMessage(extractedText);
      setOcrProgress(100);
      setActiveTab('text'); // Switch to review text and run check
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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center selection:bg-emerald-500 selection:text-slate-950 pb-12">
      {/* Top Enterprise Command Bar */}
      <nav className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-200 uppercase tracking-wider">Scam Shield Pakistan</span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline text-slate-400">SOC AI Defense Platform</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Status indicators */}
            <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 font-mono">Gemma 4 (26B-A4B-IT)</span>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300 font-mono">50+ Rules Armed</span>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setLang('roman')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  lang === 'roman' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Roman Urdu
              </button>
              <button
                type="button"
                onClick={() => setLang('urdu')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  lang === 'urdu' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                اردو رسم الخط
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="w-full max-w-4xl text-center pt-8 pb-4 px-4 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide shadow-sm">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Hacktoberfest 26 Hack Day Faisalabad | Dual-Engine Hybrid Security</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Scam <span className="text-emerald-400">Shield</span> Pakistan
        </h1>
        <p className={`text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed ${lang === 'urdu' ? 'font-serif' : ''}`}>
          {lang === 'urdu'
            ? 'ایزی پیسہ، جاز کیش، بینک اور بی آئی ایس پی فراڈ پیغامات کی گُوگل جیما 4 اور ہائبرڈ سیکیورٹی رولز کے ذریعے فوری جانچ۔'
            : 'Check suspicious SMS, WhatsApp, Easypaisa, JazzCash, bank, and BISP messages with Google Gemma 4 and heuristic cybersecurity rules.'}
        </p>

        {/* Protection Platforms Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <span className="text-slate-500 font-mono">Protected Platforms:</span>
          {['Easypaisa', 'JazzCash', 'HBL', 'UBL', 'Meezan', 'BISP', 'NADRA', 'FESCO'].map((item) => (
            <span key={item} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              {item}
            </span>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-4xl px-4 space-y-6">
        {/* Input Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'text'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900/40 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Message / Link Text</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('screenshot')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'screenshot'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900/40 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span className="flex items-center gap-1.5">
              <span>Upload Screenshot (OCR)</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                New
              </span>
            </span>
          </button>
        </div>

        {/* Input Area Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
          {activeTab === 'text' ? (
            <form onSubmit={handleCheck} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="message-input" className="block text-sm font-medium text-slate-200">
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
                  className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-transparent text-sm sm:text-base transition-all resize-y leading-relaxed"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Gemma 4 + Heuristics Hybrid Layer
                </span>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === 'urdu' ? 'جیما 4 جانچ رہا ہے...' : 'Gemma 4 is Analyzing...'}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{lang === 'urdu' ? 'جانچ کریں (Check Message)' : 'Check Message (Jaanchein)'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Screenshot Upload Tab with Tesseract.js OCR */
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
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/80 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/50 hover:bg-slate-900/50 space-y-3"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Click to upload SMS or WhatsApp Screenshot
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PNG, JPG, WEBP. Our on-device OCR extracts the text automatically.
                  </p>
                </div>
              </div>

              {ocrLoading && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      Extracting text with optical character recognition...
                    </span>
                    <span className="font-mono text-emerald-400">{ocrProgress}%</span>
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
                      Text has been recognized. Switch back to the text tab to review and scan!
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1-Click Example Scenarios */}
          <div className="pt-4 border-t border-slate-800/80">
            <p className="text-xs font-semibold text-slate-400 mb-2.5 flex items-center gap-1.5">
              <span>Try Live Pakistani Scenarios (Demo Ready):</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {examples.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setMessage(ex.text);
                    setActiveTab('text');
                  }}
                  className="p-2.5 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-xs space-y-1 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                      {ex.title}
                    </span>
                    <span className="text-[10px]">{ex.badge}</span>
                  </div>
                  <p className="text-slate-400 line-clamp-1 text-[11px] font-mono">
                    {ex.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Alert</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Fallback Notification */}
        {fallbackActive && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Fail-Safe Active:</strong> Deterministic rules engine evaluated this message because the AI network connection was unavailable.
            </span>
          </div>
        )}

        {/* Enterprise Assessment Card */}
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
                  Threat Severity: <strong className="text-white">{assessment.threatScore}%</strong>
                </span>
              </div>
            </div>

            {/* Threat Meter Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Threat Gauge</span>
                <span className={currentTheme.accentText}>{assessment.finalRisk.toUpperCase()} SEVERITY</span>
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
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Dual-Engine Explainability (Which Layer Caught What):</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Gemma AI Layer */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
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
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
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
                    className={`flex items-start gap-2.5 text-sm text-slate-200 bg-slate-900/70 p-3 rounded-xl border border-slate-800 ${
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
                    className={`flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-slate-900/70 p-3 rounded-xl border border-slate-800 ${
                      lang === 'urdu' ? 'font-serif' : ''
                    }`}
                  >
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Judges View / Deep Dive Payload */}
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

      {/* Footer Disclaimer */}
      <footer className="mt-12 text-center text-xs text-slate-500 max-w-xl px-4 space-y-2">
        <p className={lang === 'urdu' ? 'font-serif' : ''}>
          ⚠️ {lang === 'urdu' ? 'یہ رہنمائی کے لیے ہے، حتمی قانونی فیصلہ نہیں۔' : 'Yeh madad hai, final faisla nahi. / This is guidance, not a guarantee.'}
        </p>
        <p className="font-mono text-[11px] text-slate-600">
          Scam Shield Pakistan • Gemma 4 Open-Weight AI (Apache 2.0) • MLH Hacktoberfest Faisalabad • MIT License
        </p>
      </footer>
    </main>
  );
}
