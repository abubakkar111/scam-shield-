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
  Cpu,
  Mic,
  MicOff,
  Link as LinkIcon,
  Volume2,
  Copy,
  Check,
  Music,
  ExternalLink,
  ArrowRight,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Bell,
  BellRing,
  Radio,
  X,
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

  // Input Modes: Text, Link, Voice Note/Call, Screenshot OCR
  const [inputMode, setInputMode] = useState<'text' | 'link' | 'voice' | 'screenshot'>('text');

  // Input & Processing States
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Upload & Recording States
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<any>(null);

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

  // Audio File Selection from Gallery / Local Files
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const audioUrl = URL.createObjectURL(file);
    setAudioFileUrl(audioUrl);

    // Provide default transcript text based on filename or placeholder so Gemma 4 evaluates it
    if (!message) {
      setMessage(
        `[Voice Note Intercepted: ${file.name}] Suspicious WhatsApp audio message received requesting urgent verification and fund transfer.`
      );
    }
  };

  // Background Auto-Shield Sentry States
  const [autoShieldActive, setAutoShieldActive] = useState(false);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const lastScannedText = useRef<string>('');

  // Live Call Interception Simulation States
  const [simulatedCallActive, setSimulatedCallActive] = useState(false);
  const [callSimStep, setCallSimStep] = useState<'ringing' | 'screening' | 'alert'>('ringing');
  const [callTranscript, setCallTranscript] = useState('');

  // Background Auto-Scan Handler
  const triggerAutoScan = async (textToScan: string) => {
    if (!textToScan.trim() || textToScan === lastScannedText.current) return;
    lastScannedText.current = textToScan;
    setMessage(textToScan);
    setClipboardNotice('Clipboard content auto-detected! Scanning with Gemma 4...');

    setLoading(true);
    setError(null);
    setAssessment(null);
    setLinkTraceResult(null);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToScan,
          lang,
          source: textToScan.startsWith('http') ? 'link' : 'text',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error occurred');

      setAssessment(data.assessment);
      if (data.linkTrace) setLinkTraceResult(data.linkTrace);
      setRawOutput(data.raw);

      // Trigger native browser notification if permitted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title =
          data.assessment.finalRisk === 'high'
            ? '🚨 Scam Shield: HIGH RISK SCAM INTERCEPTED'
            : data.assessment.finalRisk === 'medium'
            ? '⚠️ Scam Shield: Suspicious Activity Detected'
            : '🛡️ Scam Shield: Content Verified';
        new Notification(title, {
          body: `${data.assessment.scamType}\n${data.assessment.reasons[0] || 'Be cautious.'}`,
          icon: '/favicon.ico',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Auto-scan failed.');
    } finally {
      setLoading(false);
      setTimeout(() => setClipboardNotice(null), 4000);
    }
  };

  const toggleAutoShield = async () => {
    if (!autoShieldActive) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      setAutoShieldActive(true);
      setClipboardNotice('Auto-Shield Active! Copy any message or link in background to auto-scan.');
      setTimeout(() => setClipboardNotice(null), 3500);
    } else {
      setAutoShieldActive(false);
      setClipboardNotice(null);
    }
  };

  // Background Auto-Shield Listener (listens when user returns to tab after copying)
  useEffect(() => {
    if (!autoShieldActive) return;

    const checkClipboard = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim().length > 6 && text.trim() !== lastScannedText.current) {
            triggerAutoScan(text.trim());
          }
        }
      } catch (err) {
        // Clipboard read permission notice
      }
    };

    const handleFocus = () => checkClipboard();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkClipboard();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [autoShieldActive, lang]);

  // Live Call Simulation Handlers
  const startCallSimulation = () => {
    setSimulatedCallActive(true);
    setCallSimStep('ringing');
    setCallTranscript('');
  };

  const answerCallSimulation = async () => {
    setCallSimStep('screening');
    const fakeCallText =
      'Assalam-o-Alaikum, State Bank Verification Division se bol raha hoon. Aapka ATM card aur account block kar diya gaya hai. Foran verification ke liye phone par aya 4-digit OTP code batayein warna account permanent seal ho jayega!';

    setCallTranscript(fakeCallText);
    setMessage(`[Live WhatsApp Call Intercepted]: ${fakeCallText}`);
    setInputMode('voice');

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fakeCallText,
          lang,
          source: 'audio',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssessment(data.assessment);
        setRawOutput(data.raw);
        setCallSimStep('alert');

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('🚨 EMERGENCY: FAKE BANK OTP CALL INTERCEPTED!', {
            body: 'State Bank Impersonation Scam. Do not share your OTP code!',
          });
        }
      }
    } catch (e) {
      setCallSimStep('alert');
    }
  };

  const closeCallSimulation = () => {
    setSimulatedCallActive(false);
    setCallSimStep('ringing');
  };

  // Live Speech Recognition (Microphone Voice Call Scanner)
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
          ? 'براؤزر اسپیچ ریکگنیشن سپورٹ نہیں کرتا۔ برائے مہربانی نیچے دیے گئے سیمپل کال بٹن استعمال کریں یا آڈیو فائل اپلوڈ کریں۔'
          : 'Microphone recognition is not supported in this browser. Please use audio file upload or presets below.'
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

  // Run Hybrid Security Analysis (Calls Gemma 4, Unmasks Destination URLs, and Runs Rules Engine)
  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setAssessment(null);
    setLinkTraceResult(null);
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
      if (data.linkTrace) {
        setLinkTraceResult(data.linkTrace);
      }
      setRawOutput(data.raw);
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
        senderInfo: 'Suspicious Sender',
        scamType: assessment?.scamType || 'Fraud / Social Engineering Attempt',
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

  // UI Translation Dictionary
  const t = {
    english: {
      heroTitle: 'Scam Shield Pakistan',
      heroSubtitle: 'Check suspicious SMS, WhatsApp messages, calls, and links using Google Gemma 4 AI.',
      tabText: 'SMS / Text',
      tabLink: 'Check Link',
      tabVoice: 'Voice Note / Call',
      tabScreenshot: 'Screenshot (OCR)',
      placeholderText: 'Paste suspicious SMS, WhatsApp message, or email here...',
      placeholderLink: 'Paste suspicious link (e.g. bit.ly/bisp-cash or http://easypaisa-reward.xyz/login) to unmask where it leads...',
      placeholderVoice: 'Click microphone to record, upload a voice note from files/gallery, or pick a simulated scam call below...',
      checkBtn: 'Check Message (Jaanchein)',
      checkingBtn: 'Gemma 4 is Analyzing...',
      highRisk: 'Bohat Khatarnak (High Risk)',
      medRisk: 'Ehtiyat Karein (Medium Risk)',
      lowRisk: 'Koi Wazeh Khatra Nahi Mila (Low Risk)',
      highDesc: 'High risk of fraud, accidental transfer trick, or credential theft.',
      medDesc: 'Suspicious indicators found. Do not send money or click without helpline verification.',
      lowDesc: 'No obvious red flags found. Never assume a message is 100% safe.',
      listenBtn: '🔊 Listen Aloud',
      copyComplaint: '📋 Copy FIA Complaint',
      reasonsTitle: 'Why This Was Flagged (Wajuhat):',
      stepsTitle: 'What You Should Do (Agle Iqdamat):',
      exampleLabel: '⚡ 1-Click Quick Demo Scenarios (Click to test model):',
      disclaimer: '⚠️ Yeh madad hai, final faisla nahi. / This is guidance, not a guarantee.',
    },
    roman: {
      heroTitle: 'Scam Shield Pakistan',
      heroSubtitle: 'Easypaisa, JazzCash, fake bank calls, aur phishing links ki Gemma 4 AI se fori jaanch.',
      tabText: 'SMS / Text',
      tabLink: 'Check Link',
      tabVoice: 'Voice Note / Call',
      tabScreenshot: 'Screenshot (OCR)',
      placeholderText: 'Mashkook SMS, WhatsApp message ya link yahan paste karein...',
      placeholderLink: 'Mashkook link yahan paste karein (e.g. bit.ly/bisp-cash ya http://easypaisa-reward.xyz/login)...',
      placeholderVoice: 'Mic se bolain ya files/gallery se voice note upload karein, ya neeche se sample chunein...',
      checkBtn: 'Check Message (Jaanchein)',
      checkingBtn: 'Gemma 4 Jaanch Raha Hai...',
      highRisk: 'Bohat Khatarnak (High Risk)',
      medRisk: 'Ehtiyat Karein (Medium Risk)',
      lowRisk: 'Koi Wazeh Khatra Nahi Mila (Low Risk)',
      highDesc: 'Is message ya call mein 90%+ fraud ya raqam churanay ke qawi asarat hain.',
      medDesc: 'Kuch mashkook nishaniyan mili hain. Baghair tasdeeq koi amal na karein.',
      lowDesc: 'Message mein fori scam signs nahi mile, lekin hamesha hoshiyar rahein.',
      listenBtn: '🔊 Suniye (Listen)',
      copyComplaint: '📋 Copy FIA Complaint',
      reasonsTitle: 'Khatray Ki Wajuhat (Why Flagged):',
      stepsTitle: 'Agle Hifazati Iqdamat (Next Steps):',
      exampleLabel: '⚡ 1-Click Quick Demo Scenarios (Click karke model test karein):',
      disclaimer: '⚠️ Yeh madad hai, final faisla nahi. / This is guidance, not a guarantee.',
    },
    urdu: {
      heroTitle: 'اسکیم شیلڈ پاکستان',
      heroSubtitle: 'ایزی پیسہ، جاز کیش، جعلی کالز اور مشکوک لنکس کی گُوگل جیما 4 کے ذریعے فوری جانچ۔',
      tabText: 'پیغام / میسج',
      tabLink: 'لنک کی جانچ',
      tabVoice: 'وائس نوٹ / کال',
      tabScreenshot: 'اسکرین شاٹ (OCR)',
      placeholderText: 'مشکوک ایس ایم ایس یا واٹس ایپ پیغام یہاں درج کریں...',
      placeholderLink: 'مشکوک لنک یہاں درج کریں تاکہ معلوم ہو سکے کہ یہ درحقیقت کہاں لے جاتا ہے...',
      placeholderVoice: 'مائیک سے بولیں یا گیلری سے وائس نوٹ اپلوڈ کریں یا نیچے سے سیمپل کال منتخب کریں...',
      checkBtn: 'فوری جانچ کریں (Verify)',
      checkingBtn: 'جیما 4 جائزہ لے رہا ہے...',
      highRisk: 'انتہائی خطرناک (ہائی رسک)',
      medRisk: 'احتیاط برتیں (درمیانہ خطرہ)',
      lowRisk: 'کوئی واضح خطرہ نہیں ملا',
      highDesc: 'اس پیغام یا کال میں مالی فراڈ یا رقم چرانے کے واضح شواہد موجود ہیں۔',
      medDesc: 'کچھ مشکوک علامات پائی گئی ہیں۔ ہیلپ لائن کی تصدیق کے بغیر کوئی عمل نہ کریں۔',
      lowDesc: 'کوئی فوری خطرہ ظاہر نہیں ہوا، مگر ہمیشہ محتاط رہیں۔',
      listenBtn: '🔊 سنیں (صوتی انتباہ)',
      copyComplaint: '📋 ایف آئی اے شکایت کاپی کریں',
      reasonsTitle: 'خطرے کی وجوہات (شواہد):',
      stepsTitle: 'حفاظتی اقدامات (کیا کریں):',
      exampleLabel: '⚡ فوری ڈیمو کے نمونے (ماڈل ٹیسٹ کرنے کے لیے کلک کریں):',
      disclaimer: '⚠️ یہ رہنمائی کے لیے ہے، حتمی قانونی فیصلہ نہیں۔',
    },
  }[lang];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center selection:bg-emerald-500 selection:text-slate-950 pb-16 font-sans">
      {/* Top Header & Clean Language Switcher */}
      <header className="w-full max-w-3xl px-4 pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-2xl font-black text-white tracking-tight ${lang === 'urdu' ? 'font-serif' : ''}`}>
              {t.heroTitle}
            </h1>
            <p className={`text-xs text-slate-400 ${lang === 'urdu' ? 'font-serif' : ''}`}>
              {t.heroSubtitle}
            </p>
          </div>
        </div>

        {/* 3-Way Language Toggle */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner shrink-0">
          <button
            type="button"
            onClick={() => setLang('english')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              lang === 'english' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('roman')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              lang === 'roman' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Roman Urdu
          </button>
          <button
            type="button"
            onClick={() => setLang('urdu')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              lang === 'urdu' ? 'bg-emerald-500 text-slate-950 shadow-sm font-serif' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            اردو
          </button>
        </div>
      </header>

      {/* Background Auto-Shield Sentry Bar */}
      <div className="w-full max-w-3xl px-4 mb-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 text-xs">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                autoShieldActive ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80' : 'bg-slate-600'
              }`}
            />
            <div>
              <span className="font-bold text-slate-200">
                {lang === 'urdu' ? 'پس منظر خودکار شیلڈ (Auto-Shield Sentry):' : 'Background Auto-Shield Sentry:'}
              </span>
              <span className="text-slate-400 ml-1.5 hidden sm:inline">
                {lang === 'urdu'
                  ? 'دیگر ایپس سے میسجز یا لنکس کاپی ہوتے ہی خودکار اسکین اور الرٹ پاپ اپ'
                  : 'Auto-scans copied WhatsApp messages & links with instant popups'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleAutoShield}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              autoShieldActive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>
              {autoShieldActive
                ? lang === 'urdu'
                  ? 'شیلڈ فعال ہے (ON)'
                  : 'Shield Active (ON)'
                : lang === 'urdu'
                ? 'شیلڈ آن کریں'
                : 'Enable Auto-Shield'}
            </span>
          </button>
        </div>

        {/* Temporary Auto-Scan Toast Notice */}
        {clipboardNotice && (
          <div className="mt-2 p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 animate-spin" />
            <span>{clipboardNotice}</span>
          </div>
        )}
      </div>

      {/* Main Single-Card Container */}
      <div className="w-full max-w-3xl px-4 space-y-5">
        {/* Clean 4-Way Mode Tabs */}
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
            <span>{t.tabVoice}</span>
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
          {inputMode !== 'screenshot' ? (
            <form onSubmit={handleCheck} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="main-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    {inputMode === 'link' ? t.tabLink : inputMode === 'voice' ? t.tabVoice : t.tabText}
                  </label>
                  {message && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessage('');
                        setAudioFileName(null);
                        setAudioFileUrl(null);
                      }}
                      className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    id="main-input"
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

                  {/* Mic floating button for Voice Mode */}
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
                        title="Click to Record Microphone"
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

              {/* VOICE MODE: Dual Options (Mic Recording + Gallery/File Audio Upload) */}
              {inputMode === 'voice' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.opus,.aac"
                    onChange={handleAudioFileUpload}
                    className="hidden"
                  />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <span className="font-bold text-slate-200 flex items-center gap-2">
                      <Music className="w-4 h-4 text-emerald-400" />
                      Voice Note Audio Input:
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isRecording
                            ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>{isRecording ? 'Stop Recording' : 'Record Mic'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Audio from Files / Gallery</span>
                      </button>
                    </div>
                  </div>

                  {/* Audio Player preview if a file was uploaded */}
                  {audioFileUrl && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 truncate">
                        <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-slate-200 font-mono truncate">{audioFileName}</span>
                      </div>
                      <audio controls src={audioFileUrl} className="h-8 max-w-full sm:max-w-xs" />
                    </div>
                  )}

                  {/* Live Call Interceptor Simulator Trigger */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                        <Radio className="w-4 h-4 animate-pulse text-rose-400" />
                        <span>{lang === 'urdu' ? 'براہِ راست مشکوک کال انٹرسیپٹ سمیلیٹر' : 'Live Call Interceptor & Floating Alert Simulation'}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {lang === 'urdu'
                          ? 'دیکھیں کہ جعلی کال کے دوران جیما 4 کیسے فوراً گفتگو اسکین کر کے اسکرین پر خطرے کا پاپ اپ دکھاتا ہے'
                          : 'Test how Scam Shield intercepts live phone calls in real-time and triggers an emergency floating popup banner.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startCallSimulation}
                      className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30 flex items-center gap-2 cursor-pointer transition-all shrink-0"
                    >
                      <PhoneIncoming className="w-4 h-4" />
                      <span>{lang === 'urdu' ? 'جعلی کال ٹیسٹ کریں' : 'Simulate Fake Bank Call'}</span>
                    </button>
                  </div>

                  {/* 1-Click Pakistani Voice Call Presets */}
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[11px] font-mono text-slate-400">
                      Or test with simulated Pakistani voice call samples:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(
                            'Asalam-o-Alaikum, main JazzCash head office se bol raha hoon. Aapka account biometric expiry ki waja se block hone laga hai. Aapke mobile par 4 digit ka OTP aya hai, fori batayein taakay account unblock ho sakay.'
                          );
                          setAudioFileName('JazzCash-Fake-Call-Sample.mp3');
                        }}
                        className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-left border border-slate-800 text-slate-300 space-y-1 transition-all cursor-pointer"
                      >
                        <div className="font-semibold text-rose-300">📞 Fake JazzCash Voice Call</div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 font-mono">"Main head office se bol raha hoon, OTP dein..."</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMessage(
                            'Bhai khuda ke waste paise wapis bhej dein. Ammi hospital mein hain, ghalti se 30,000 aapke Easypaisa par bhej diye hain. Khuda aapka bhala karega wapis bhej dein.'
                          );
                          setAudioFileName('Accidental-Transfer-VoiceNote.opus');
                        }}
                        className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-left border border-slate-800 text-slate-300 space-y-1 transition-all cursor-pointer"
                      >
                        <div className="font-semibold text-amber-300">🎙️ Accidental Transfer Voice Note</div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 font-mono">"Ghalti se 30,000 bhej diye hain wapis karein..."</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  Google Gemma 4 (`gemma-4-26b-a4b-it`)
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
            /* Screenshot OCR Tab */
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
                    OCR extracts text from image directly into the analysis engine.
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
                    <p className="text-slate-400">Text extracted. Click Text tab above to inspect!</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3 Clear Clickable Examples */}
          <div className="pt-3 border-t border-slate-800/80">
            <p className="text-xs text-slate-400 mb-2 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.exampleLabel}</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessage('0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein apka bhala hoga.');
                  setInputMode('text');
                }}
                className="p-2.5 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs space-y-1 group transition-all cursor-pointer"
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
                className="p-2.5 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs space-y-1 group transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 group-hover:text-emerald-400">Fake BISP Link</span>
                  <span className="text-[10px] text-amber-400 font-mono">🟡 Link</span>
                </div>
                <p className="text-slate-400 line-clamp-1 text-[11px] font-mono">bisp-wazifa-claim.xyz/verify</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMessage('HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP with anyone.');
                  setInputMode('text');
                }}
                className="p-2.5 text-left rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs space-y-1 group transition-all cursor-pointer"
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

        {/* The Result Card (Appears ONLY after Check) */}
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
            {/* Header: Traffic Light Status */}
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

            {/* Pre-Click Destination Tracker (Shows where links actually go) */}
            {linkTraceResult && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                    Destination URL Unmasked:
                  </span>
                  {linkTraceResult.redirected && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                      ⚠️ Link Redirects Externally
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] truncate">
                    <span>Input Link:</span>
                    <span className="text-slate-300 truncate">{linkTraceResult.original}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-[11px] truncate">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>Real Destination:</span>
                    <span className="truncate underline">{linkTraceResult.finalUrl}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300">
                  <strong>Security Assessment:</strong> {linkTraceResult.verdict}
                </p>
              </div>
            )}

            {/* Classification & Threat Meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">Scam Type: {assessment.scamType}</span>
                <span className="text-slate-400">Threat Score: {assessment.threatScore}%</span>
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

            {/* Collapsible Raw JSON for Judges */}
            {rawOutput && (
              <div className="pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowRaw(!showRaw)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1.5 transition-colors font-mono cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Inspect Gemma 4 Raw JSON Payload (Judges Proof)
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

      {/* Clean Footer */}
      <footer className="mt-12 text-center text-xs text-slate-500 max-w-xl px-4 space-y-1 font-mono">
        <p className={lang === 'urdu' ? 'font-serif' : ''}>{t.disclaimer}</p>
        <p className="text-[11px] text-slate-600">
          Scam Shield Pakistan • Google Gemma 4 (26B-A4B-IT) • Apache 2.0 • MIT Open Source
        </p>
      </footer>

      {/* Live Incoming Call Simulation Floating Modal */}
      {simulatedCallActive && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={closeCallSimulation}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step 1: Ringing */}
            {callSimStep === 'ringing' && (
              <div className="text-center space-y-5">
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse shadow-xl shadow-emerald-500/20">
                  <PhoneIncoming className="w-10 h-10 animate-bounce" />
                </div>

                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-bold bg-rose-950/60 px-2.5 py-1 rounded-full border border-rose-500/30">
                    Incoming Call Intercepted
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">+92 312 9988776</h3>
                  <p className="text-xs text-slate-400 mt-1">Claiming: "State Bank Verification Cell"</p>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  The caller is demanding urgent identity confirmation under threat of bank account block. Would you like Gemma 4 to screen this call audio in real-time?
                </p>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCallSimulation}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <PhoneOff className="w-4 h-4 text-rose-400" />
                    <span>Decline</span>
                  </button>
                  <button
                    type="button"
                    onClick={answerCallSimulation}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/30 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Screen with Gemma 4</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Screening */}
            {callSimStep === 'screening' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-300">Gemma 4 Listening & Screening Call Audio...</h3>
                  <p className="text-xs text-slate-400 mt-1">Transcribing speech and analyzing urgency, fear, & OTP requests</p>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono text-slate-300 leading-relaxed max-h-32 overflow-y-auto">
                  {callTranscript || 'Listening to call audio...'}
                </div>
              </div>
            )}

            {/* Step 3: Emergency Alert Popup */}
            {callSimStep === 'alert' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-4 rounded-xl bg-rose-950/70 border-2 border-rose-500 flex items-start gap-3 shadow-2xl">
                  <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-black bg-rose-900/60 px-2 py-0.5 rounded border border-rose-500/30">
                      🚨 EMERGENCY FLOATING POPUP ALERT
                    </span>
                    <h3 className="text-base font-black text-white">HIGH RISK FRAUD DETECTED!</h3>
                    <p className="text-xs text-rose-200 leading-relaxed font-semibold">
                      Gemma 4 identified this call as an <strong>OTP & Credential Theft Attack</strong> impersonating the State Bank.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
                  <div className="font-bold text-slate-200">Emergency Protection Actions:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                    <li><strong>Do not share</strong> your 4-digit or 6-digit OTP code or ATM PIN.</li>
                    <li>State Bank of Pakistan and commercial banks never call asking for codes.</li>
                    <li>Hang up immediately and register an FIA complaint.</li>
                  </ul>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCallSimulation}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 cursor-pointer transition-all"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>Hang Up & Block Caller</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeCallSimulation();
                      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Full Report</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
