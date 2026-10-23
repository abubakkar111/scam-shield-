'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Send,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Mic,
  MicOff,
  Image as ImageIcon,
  Music,
  Link as LinkIcon,
  Volume2,
  Lock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  Cpu,
  Shield,
  Smartphone,
  Info,
  CheckCircle2,
  Share2,
  FileText,
  AlertCircle,
  Radio,
  PhoneCall,
  PhoneOff,
  Bell,
  BellRing,
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

interface InterceptionAlert {
  source: 'call' | 'clipboard' | 'link';
  scamType: string;
  triggerSnippet: string;
  threatLevel: 'high' | 'medium';
  recommendedAction: string;
}

export default function Home() {
  // 3-Way Language Selector: English, Roman Urdu, Urdu (اردو)
  const [lang, setLang] = useState<'english' | 'roman' | 'urdu'>('roman');

  // Input & Processing States
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-Detect & Live Sentry Call Guard States
  const [sentryActive, setSentryActive] = useState(true);
  const [sentryListening, setSentryListening] = useState(false);
  const [liveAudioSnippet, setLiveAudioSnippet] = useState<string | null>(null);
  const [interceptionAlert, setInterceptionAlert] = useState<InterceptionAlert | null>(null);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const lastScannedTextRef = useRef<string>('');
  const sentryRecognitionRef = useRef<any>(null);

  // Result States
  const [assessment, setAssessment] = useState<CombinedAssessment | null>(null);
  const [linkTraceResult, setLinkTraceResult] = useState<LinkTraceData | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [showDeepForensics, setShowDeepForensics] = useState(false);
  const [copiedComplaint, setCopiedComplaint] = useState(false);

  // Screenshot OCR States
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Audio Upload & Direct Mic Recording States
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const directRecognitionRef = useRef<any>(null);

  // Real-time Link Detection within the message text
  const detectedUrl = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/i;
    const match = message.match(urlRegex);
    return match ? match[0] : null;
  }, [message]);

  // Web Audio API Synthesized Police / Security Siren Alert
  const playSirenAlert = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(587, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);
      osc.frequency.setValueAtTime(587, now + 0.45);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      console.error('Audio siren error:', e);
    }
  }, []);

  // Browser Native Push Notification Trigger
  const triggerNativeNotification = useCallback((title: string, body: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              new Notification(title, { body });
            }
          });
        }
      }
    } catch (e) {}
  }, []);

  // Trigger Live Interception Modal with Audio Siren + Notification
  const triggerInterception = useCallback(
    (alert: InterceptionAlert) => {
      setInterceptionAlert(alert);
      playSirenAlert();
      triggerNativeNotification(`🚨 SCAM SHIELD ALERT: ${alert.scamType}`, alert.recommendedAction);

      // Voice Warning
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const speech =
          lang === 'urdu'
            ? 'خبردار! کال یا پیغام پر فراڈ کی کوشش پکڑی گئی ہے۔ اپنا او ٹی پی یا رقم ہرگز نہ بھیجیں!'
            : 'Warning! Fraud detected on your active call or message. Do not share your OTP or send funds!';
        const utterance = new SpeechSynthesisUtterance(speech);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    },
    [lang, playSirenAlert, triggerNativeNotification]
  );

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

  // Request Notification permission when user visits
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

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
          throw new Error(data.error || 'Security scanner error occurred');
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
        setError(err.message || 'Inspection failed. Please retry.');
      } finally {
        setLoading(false);
      }
    },
    [lang, audioFileName]
  );

  // START CONTINUOUS LIVE SENTRY LISTENER (Listens to phone calls & conversations)
  const toggleLiveSentry = useCallback(() => {
    if (sentryListening) {
      if (sentryRecognitionRef.current) {
        try {
          sentryRecognitionRef.current.stop();
        } catch (e) {}
      }
      setSentryListening(false);
      setSentryActive(false);
      setLiveAudioSnippet(null);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        lang === 'urdu'
          ? 'براؤزر لائیو کال گارڈ کو سپورٹ نہیں کرتا۔ برائے مہربانی کروم استعمال کریں۔'
          : 'Live Call Sentry is not supported in this browser. Please use Chrome or Edge.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang === 'urdu' ? 'ur-PK' : 'en-US';

      recognition.onstart = () => {
        setSentryListening(true);
        setSentryActive(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let liveTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          liveTranscript += event.results[i][0].transcript;
        }

        if (liveTranscript.trim()) {
          const text = liveTranscript.trim();
          setLiveAudioSnippet(text);

          const lower = text.toLowerCase();
          const scamTriggers = [
            'otp',
            'code',
            'block',
            'pin',
            'password',
            'easypaisa',
            'jazzcash',
            'wapis',
            'ghalti se',
            'lottery',
            'bisp',
            'biometric',
            'wazifa',
            'account block',
            'urgent',
            'benazir',
          ];

          const isThreat = scamTriggers.some((kw) => lower.includes(kw));

          if (isThreat && !interceptionAlert) {
            triggerInterception({
              source: 'call',
              scamType: 'Live Call Extortion / OTP Theft',
              triggerSnippet: text,
              threatLevel: 'high',
              recommendedAction:
                'Caller is asking for credentials or financial reversal. DO NOT SHARE ANY CODES OR TAP APPROVE!',
            });
            setMessage(`[Live Call Interception] "${text}"`);
            executeAnalysis(text);
          }
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Live Sentry listener error:', err);
        setSentryListening(false);
      };

      recognition.onend = () => {
        setSentryListening(false);
      };

      sentryRecognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error('Sentry start error:', e);
      setSentryListening(false);
      setError('Microphone permission required for Live Call Guard.');
    }
  }, [sentryListening, lang, interceptionAlert, triggerInterception, executeAnalysis]);

  // ZERO-CLICK AUTO-DETECT: When user opens or focuses the tab, automatically detect clipboard!
  useEffect(() => {
    if (!sentryActive) return;

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
          setAutoNotice('⚡ Message copied from WhatsApp intercepted & auto-scanned!');
          setTimeout(() => setAutoNotice(null), 3500);

          // Check if it's a suspicious link or scam
          const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/i;
          const hasLink = Boolean(trimmed.match(urlRegex));
          const lower = trimmed.toLowerCase();
          const suspicious =
            hasLink ||
            lower.includes('ghalti') ||
            lower.includes('wapis') ||
            lower.includes('otp') ||
            lower.includes('block') ||
            lower.includes('bisp') ||
            lower.includes('wazifa');

          if (suspicious) {
            triggerInterception({
              source: hasLink ? 'link' : 'clipboard',
              scamType: hasLink ? 'Suspicious External Phishing Link' : 'WhatsApp Social Engineering Attempt',
              triggerSnippet: trimmed,
              threatLevel: 'high',
              recommendedAction:
                'Do not click the destination link or send money. Run full verification before responding.',
            });
          }

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
  }, [sentryActive, executeAnalysis, triggerInterception]);

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

  // Direct Speech Recognition for the Textarea
  const toggleDirectRecording = () => {
    if (isRecording) {
      if (directRecognitionRef.current) {
        directRecognitionRef.current.stop();
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
          : 'Microphone speech recognition is not supported in this browser. Please upload an audio file or type text.'
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
        console.error('Speech error:', err);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      directRecognitionRef.current = recognition;
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
        throw new Error('Could not extract readable text from screenshot. Please try a clearer image.');
      }

      setMessage(extractedText);
      setOcrProgress(100);
      executeAnalysis(extractedText);
    } catch (ocrErr: any) {
      console.error('OCR Error:', ocrErr);
      setError(ocrErr.message || 'Screenshot OCR scanning failed.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Preset Simulator
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

  // Paste from clipboard helper button
  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setMessage(text.trim());
          executeAnalysis(text.trim());
        }
      }
    } catch (e) {
      // Ignore if user denies clipboard prompt
    }
  };

  // Simulate Live Scammer Call (for Testing & Judges)
  const handleSimulateScammerCall = () => {
    const fakeCallText =
      'Main bank head office se biometric verification branch manager bol raha hoon. Aapka Easypaisa aur bank account 15 minute mein block ho raha hai. Abhi number par 6-digit verification OTP bheja hai foran batayein!';
    setMessage(`[Live Call Interception] "${fakeCallText}"`);
    triggerInterception({
      source: 'call',
      scamType: 'Biometric Impersonation & OTP Extortion',
      triggerSnippet: fakeCallText,
      threatLevel: 'high',
      recommendedAction:
        'Official banks NEVER ask for your SMS OTP or PIN over call. Hang up immediately and block the caller!',
    });
    executeAnalysis(fakeCallText);
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
    setInterceptionAlert(null);
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
      appName: 'Scam Shield',
      appSubtitle: 'AI Cyber Threat Intelligence',
      headline: 'Stop Scams Before They Strike.',
      tagline: 'Instant forensic detection for WhatsApp scams, fake Easypaisa transfers, phishing links, and voice notes.',
      placeholder: 'Paste suspicious message, SMS, or link here... Or use mic, audio, and screenshot below.',
      pasteBtn: 'Paste',
      scanBtn: 'Scan Threat',
      scanningBtn: 'Analyzing...',
      highRisk: 'CRITICAL SCAM DETECTED',
      medRisk: 'SUSPICIOUS ACTIVITY (CAUTION)',
      lowRisk: 'NO OBVIOUS THREATS FOUND',
      highDesc: 'High-confidence indicators of financial fraud, credential theft, or social engineering extortion.',
      medDesc: 'Suspicious characteristics identified. Do not send funds or click links without manual verification.',
      lowDesc: 'No obvious malicious patterns found. Always exercise standard digital caution.',
      listenBtn: 'Listen Warning',
      copyComplaint: 'Copy FIA Police Report',
      indicatorsTitle: 'Forensic Intelligence & Indicators',
      actionsTitle: 'Immediate Defensive Action Plan',
      examplesTitle: 'Or test these real-world Pakistani scam scenarios:',
      disclaimer: 'Guidance only, not a legal guarantee. Always cross-verify with official bank helplines.',
      deepForensics: 'Technical Intelligence & Gemma 4 Breakdown',
      sentryBannerTitle: 'Live Call & Background Sentry Guard',
      sentryBannerDesc: 'Real-time protection against incoming scam calls, voice notes & intercepted links.',
      sentryListeningState: 'LISTENING FOR LIVE CALLS',
      sentryIdleState: 'GUARD READY',
      sentryStartBtn: 'Start Live Guard',
      sentryStopBtn: 'Pause Guard',
      simulateCall: '⚡ Test Call Alert',
      modalTitle: '🚨 CRITICAL FRAUD INTERCEPTED ON ACTIVE CALL / MESSAGE!',
      modalHangUp: 'Hang Up & Block Caller',
      modalViewDossier: 'View Security Dossier',
    },
    roman: {
      appName: 'Scam Shield',
      appSubtitle: 'Pakistan Ka AI Cyber Defense',
      headline: 'Har Fraud Se Pehle Alert Ho Jayein.',
      tagline: 'Easypaisa, JazzCash, fake calls, screenshots aur mashkook links ki Gemma 4 AI se fori jaanch.',
      placeholder: 'SMS, WhatsApp message, ya link yahan paste karein... Ya neeche mic ya screenshot use karein.',
      pasteBtn: 'Paste Karein',
      scanBtn: 'Threat Scan Karein',
      scanningBtn: 'Jaanch Raha Hai...',
      highRisk: 'BOHAT KHATARNAK (HIGH RISK)',
      medRisk: 'EHTIYAT KAREIN (MEDIUM RISK)',
      lowRisk: 'KOI WAZEH KHATRA NAHI MILA',
      highDesc: 'Is message ya call mein fraud aur raqam churanay ke qawi shawahid hain.',
      medDesc: 'Kuch mashkook pehlu mile hain. Tasdeeq ke baghair koi raqam ya code na dein.',
      lowDesc: 'Fori khatra nahi mila, lekin anjaan messages par hamesha ehtiyat bartein.',
      listenBtn: 'Awaz Suniye',
      copyComplaint: 'FIA Report Copy Karein',
      indicatorsTitle: 'Khatray Ki Forensic Wajuhat',
      actionsTitle: 'Agle Hifazati Iqdamat (Next Steps)',
      examplesTitle: 'Ya in aam Pakistani frauds ko test karein:',
      disclaimer: 'Yeh madad hai, final faisla nahi. Pehle helpline se tasdeeq karein.',
      deepForensics: 'Technical Forensics & Gemma 4 Details',
      sentryBannerTitle: 'Live Call & Background Sentry Guard',
      sentryBannerDesc: 'Call ke dauran scam awaz, OTP mangnay aur links ki fori nigrani.',
      sentryListeningState: 'CALL NIGRAANI ACTIVE HAI',
      sentryIdleState: 'GUARD READY HAI',
      sentryStartBtn: 'Live Guard Chalaein',
      sentryStopBtn: 'Guard Rokein',
      simulateCall: '⚡ Fake Call Test',
      modalTitle: '🚨 LIVE CALL YA MESSAGE PAR FRAUD PAKRA GAYA!',
      modalHangUp: 'Call Kat Karein & Block Karein',
      modalViewDossier: 'Mukammal Report Dekhein',
    },
    urdu: {
      appName: 'اسکیم شیلڈ',
      appSubtitle: 'پاکستان کا مصنوعی ذہانت پر مبنی سائبر ڈیفنس سسٹم',
      headline: 'ہر فراڈ اور دھوکے سے باخبر رہیں۔',
      tagline: 'ایزی پیسہ، جاز کیش، جعلی کالز اور مشکوک لنکس کی گُوگل جیما 4 کے ذریعے فوری فرانزک جانچ۔',
      placeholder: 'مشکوک ایس ایم ایس، پیغام یا لنک یہاں درج کریں یا مائیک/تصویر کا استعمال کریں...',
      pasteBtn: 'پیسٹ کریں',
      scanBtn: 'فوری جانچ کریں',
      scanningBtn: 'جائزہ جاری ہے...',
      highRisk: 'انتہائی خطرناک (ہائی رسک)',
      medRisk: 'احتیاط برتیں (درمیانہ خطرہ)',
      lowRisk: 'کوئی واضح خطرہ نہیں ملا',
      highDesc: 'اس پیغام یا کال میں مالی فراڈ اور رقم ہتھیانے کے واضح شواہد موجود ہیں۔',
      medDesc: 'کچھ مشکوک علامات پائی گئی ہیں۔ تصدیق کے بغیر کوئی قدم نہ اٹھائیں۔',
      lowDesc: 'کوئی فوری خطرہ ظاہر نہیں ہوا، مگر ہمیشہ محتاط رہیں۔',
      listenBtn: 'صوتی الرٹ سنیں',
      copyComplaint: 'ایف آئی اے رپورٹ بنائیں',
      indicatorsTitle: 'فرانزک شواہد اور خطرے کی وجوہات',
      actionsTitle: 'فوری حفاظتی اقدامات',
      examplesTitle: 'یا ان پاکستانی فراڈ پیغامات کا تجربہ کریں:',
      disclaimer: 'یہ رہنمائی کے لیے ہے، حتمی قانونی فیصلہ نہیں۔',
      deepForensics: 'تکنیکی شواہد اور جیما 4 تفصیلات',
      sentryBannerTitle: 'لائیو کال اور پس منظر سینٹری گارڈ',
      sentryBannerDesc: 'فون کال کے دوران دھوکہ دہی کی آواز، او ٹی پی چوری اور مشکوک لنکس کی فوری نگرانی۔',
      sentryListeningState: 'کال کی نگرانی جاری ہے',
      sentryIdleState: 'گارڈ تیار ہے',
      sentryStartBtn: 'لائیو گارڈ شروع کریں',
      sentryStopBtn: 'گارڈ روکیں',
      simulateCall: '⚡ جعلی کال کا ٹیسٹ',
      modalTitle: '🚨 لائیو کال یا پیغام پر خطرناک فراڈ پکڑا گیا!',
      modalHangUp: 'کال کاٹ دیں اور بلاک کریں',
      modalViewDossier: 'سیکورٹی رپورٹ دیکھیں',
    },
  }[lang];

  return (
    <main className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center selection:bg-emerald-500 selection:text-slate-950 pb-24 font-sans relative overflow-x-hidden antialiased">
      {/* Ambient Lighting Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-60 left-10 w-72 h-72 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Floating Top Header */}
      <header className="w-full max-w-3xl px-4 sm:px-6 pt-6 pb-3 flex items-center justify-between gap-4 relative z-20">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={handleClearAll}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 p-[1px] shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all group-hover:shadow-[0_0_28px_rgba(16,185,129,0.45)]">
              <div className="w-full h-full bg-[#0B0F17] rounded-2xl flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-5 h-5 transition-transform group-hover:scale-110" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-lg sm:text-xl font-black text-white tracking-tight ${lang === 'urdu' ? 'font-serif' : ''}`}>
                {t.appName}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemma 4 IT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* 3-Way Language Segmented Pill */}
        <div className="flex items-center bg-[#0F1420]/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setLang('english')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              lang === 'english'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang('roman')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              lang === 'roman'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Roman
          </button>
          <button
            type="button"
            onClick={() => setLang('urdu')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              lang === 'urdu'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20 font-serif'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            اردو
          </button>
        </div>
      </header>

      {/* Hero Showcase Headline */}
      <section className="w-full max-w-2xl px-4 sm:px-6 pt-4 pb-4 text-center space-y-2 relative z-10">
        <h2
          className={`text-3xl sm:text-4xl font-black tracking-tight text-white ${
            lang === 'urdu' ? 'font-serif text-3xl sm:text-4xl leading-relaxed' : ''
          }`}
        >
          {t.headline}
        </h2>
        <p
          className={`text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed ${
            lang === 'urdu' ? 'font-serif text-base' : ''
          }`}
        >
          {t.tagline}
        </p>
      </section>

      {/* Main Container */}
      <div className="w-full max-w-2xl px-4 sm:px-6 space-y-4 relative z-10">
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

        {/* ========================================================================= */}
        {/* THE LIVE CALL & BACKGROUND SENTRY GUARD (The Requested Active Tab Radar) */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-r from-emerald-500/30 via-teal-500/20 to-cyan-500/30 shadow-lg">
          <div className="bg-[#0B0F17]/95 backdrop-blur-xl rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    sentryListening
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                  }`}
                >
                  {sentryListening ? <PhoneCall className="w-4 h-4 animate-bounce" /> : <Radio className="w-4 h-4" />}
                </div>
                {sentryListening && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                    {t.sentryBannerTitle}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                      sentryListening
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {sentryListening ? t.sentryListeningState : t.sentryIdleState}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {t.sentryBannerDesc}
                </p>
              </div>
            </div>

            {/* Sentry Action Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-white/[0.06]">
              {/* Simulate Live Call Button (for instant evaluation) */}
              <button
                type="button"
                onClick={handleSimulateScammerCall}
                title="Test simulated fake scammer phone call"
                className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.1] text-amber-300 hover:text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <span>{t.simulateCall}</span>
              </button>

              {/* Start / Stop Live Call Listener */}
              <button
                type="button"
                onClick={toggleLiveSentry}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  sentryListening
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                }`}
              >
                {sentryListening ? (
                  <>
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>{t.sentryStopBtn}</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{t.sentryStartBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Audio Transcription Wave (shows when listening) */}
          {sentryListening && liveAudioSnippet && (
            <div className="bg-[#07090E]/90 px-4 py-2 border-t border-white/[0.06] rounded-b-2xl flex items-center gap-2 text-xs font-mono text-emerald-300 truncate">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span className="text-slate-400 shrink-0 font-bold">Live Audio Intercept:</span>
              <span className="text-slate-200 truncate italic">"{liveAudioSnippet}"</span>
            </div>
          )}
        </div>

        {/* Temporary Auto-Scan Toast Alert */}
        {autoNotice && (
          <div className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-xl shadow-emerald-950/40 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
            <span className="font-semibold text-xs leading-tight">{autoNotice}</span>
          </div>
        )}

        {/* THE OMNI-SHIELD UNIFIED PROMPT CANVAS */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-white/[0.16] via-white/[0.05] to-transparent shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)] transition-all">
          <div className="bg-[#0B0F17]/95 backdrop-blur-2xl rounded-3xl p-4 sm:p-5 space-y-3">
            <form onSubmit={handleFormSubmit} className="space-y-3">
              {/* Textarea Area */}
              <div className="relative">
                <textarea
                  id="main-unified-input"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.placeholder}
                  dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                  className={`w-full p-3.5 sm:p-4 rounded-2xl bg-[#07090E]/90 border border-white/[0.08] text-slate-100 placeholder-slate-500 text-sm sm:text-base focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none leading-relaxed ${
                    lang === 'urdu' ? 'font-serif text-lg leading-loose' : 'font-sans'
                  }`}
                  required
                />

                {/* Real-time Link Detection Chip */}
                {detectedUrl && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs font-mono backdrop-blur-md">
                    <div className="flex items-center gap-2 truncate">
                      <LinkIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400 font-bold text-xs">Link Detected:</span>
                      <span className="text-slate-200 truncate underline text-xs">{detectedUrl}</span>
                    </div>
                    <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md font-bold shrink-0">
                      Unmasking
                    </span>
                  </div>
                )}

                {/* Audio Attachment Preview */}
                {audioFileUrl && (
                  <div className="mt-2 p-2.5 rounded-xl bg-[#0F1420] border border-white/[0.08] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Music className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                      <span className="text-slate-300 font-mono text-xs truncate">{audioFileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <audio controls src={audioFileUrl} className="h-7 max-w-[160px] sm:max-w-[200px]" />
                      <button
                        type="button"
                        onClick={() => {
                          setAudioFileUrl(null);
                          setAudioFileName(null);
                        }}
                        className="text-slate-400 hover:text-white p-1"
                        title="Remove Audio"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Screenshot OCR Scanning Bar */}
                {ocrLoading && (
                  <div className="mt-2 p-3 rounded-xl bg-[#0F1420] border border-white/[0.08] space-y-2 text-xs">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-2 font-mono">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        Scanning screenshot OCR...
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">{ocrProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Screenshot Loaded Preview */}
                {imagePreview && !ocrLoading && (
                  <div className="mt-2 flex items-center justify-between p-2.5 rounded-xl bg-[#0F1420] border border-white/[0.08]">
                    <div className="flex items-center gap-3">
                      <img src={imagePreview} alt="Screenshot" className="w-10 h-10 object-cover rounded-lg border border-slate-700" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-slate-200">Screenshot Attached</p>
                        <p className="text-[11px] text-slate-400">OCR text extracted into scanner.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="text-slate-400 hover:text-white p-1"
                      title="Remove Screenshot"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Integrated Action Bar */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                {/* Media Capture Tool Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Mic Recording Button */}
                  <button
                    type="button"
                    onClick={toggleDirectRecording}
                    title="Record Live Speech"
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                        : 'bg-[#0F1420] hover:bg-slate-800/80 border border-white/[0.08] text-slate-300 hover:text-white'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    <span>{isRecording ? `${recordingSeconds}s` : 'Voice'}</span>
                  </button>

                  {/* Screenshot Button */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    title="Attach Screenshot"
                    className="px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl bg-[#0F1420] hover:bg-slate-800/80 border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Photo</span>
                  </button>

                  {/* Audio File Button */}
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    title="Attach Audio File"
                    className="px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl bg-[#0F1420] hover:bg-slate-800/80 border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Music className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Audio</span>
                  </button>

                  {/* 1-Click Paste Clipboard Button */}
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    title="Paste from Clipboard"
                    className="px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl bg-[#0F1420] hover:bg-slate-800/80 border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">{t.pasteBtn}</span>
                  </button>
                </div>

                {/* Right: Clear + Primary Action Button */}
                <div className="flex items-center gap-2">
                  {message && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-xs font-semibold"
                      title="Clear"
                    >
                      Clear
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !message.trim()}
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t.scanningBtn}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.scanBtn}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-xs shadow-lg backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Security Notice</p>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* THE EXECUTIVE SECURITY DOSSIER (Result View) */}
        {assessment && (
          <section
            id="security-dossier"
            className={`rounded-3xl p-5 sm:p-7 transition-all space-y-6 shadow-2xl backdrop-blur-2xl border ${
              assessment.finalRisk === 'high'
                ? 'bg-gradient-to-b from-rose-950/25 via-[#0B0F17] to-[#07090E] border-rose-500/40 shadow-[0_0_60px_-15px_rgba(244,63,94,0.3)]'
                : assessment.finalRisk === 'medium'
                ? 'bg-gradient-to-b from-amber-950/25 via-[#0B0F17] to-[#07090E] border-amber-500/40 shadow-[0_0_60px_-15px_rgba(245,158,11,0.3)]'
                : 'bg-gradient-to-b from-emerald-950/25 via-[#0B0F17] to-[#07090E] border-emerald-500/40 shadow-[0_0_60px_-15px_rgba(16,185,129,0.3)]'
            }`}
          >
            {/* Header: Traffic Light Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                    assessment.finalRisk === 'high'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-rose-500/25'
                      : assessment.finalRisk === 'medium'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/25'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-emerald-500/25'
                  }`}
                >
                  {assessment.finalRisk === 'high' ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : assessment.finalRisk === 'medium' ? (
                    <AlertTriangle className="w-7 h-7" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <h3
                    className={`text-xl sm:text-2xl font-black tracking-tight ${
                      assessment.finalRisk === 'high'
                        ? 'text-rose-400'
                        : assessment.finalRisk === 'medium'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    } ${lang === 'urdu' ? 'font-serif text-2xl' : ''}`}
                  >
                    {assessment.finalRisk === 'high'
                      ? t.highRisk
                      : assessment.finalRisk === 'medium'
                      ? t.medRisk
                      : t.lowRisk}
                  </h3>
                  <p className={`text-xs sm:text-sm text-slate-300 mt-0.5 leading-relaxed ${lang === 'urdu' ? 'font-serif' : ''}`}>
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
                  title="Listen Aloud"
                  className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.1] text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.listenBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyComplaint}
                  title="Copy Legal Report"
                  className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.1] text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  {copiedComplaint ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedComplaint ? 'Copied' : t.copyComplaint}</span>
                </button>
              </div>
            </div>

            {/* Unmasked Destination Link Card */}
            {linkTraceResult && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5 uppercase text-xs">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                    Target Destination Unmasked:
                  </span>
                  {linkTraceResult.redirected && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                      Redirects Externally
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#07090E] border border-white/[0.06] space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs truncate">
                    <span>Input Link:</span>
                    <span className="text-slate-300 truncate">{linkTraceResult.original}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs truncate">
                    <ArrowRight className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Real Destination:</span>
                    <span className="truncate underline">{linkTraceResult.finalUrl}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">Security Assessment:</strong> {linkTraceResult.verdict}
                </p>
              </div>
            )}

            {/* Threat Meter Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-200 font-bold">Classification: {assessment.scamType}</span>
                <span className="text-slate-400 font-bold">Threat Index: {assessment.threatScore}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/[0.06]">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    assessment.finalRisk === 'high'
                      ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                      : assessment.finalRisk === 'medium'
                      ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                      : 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                  }`}
                  style={{ width: `${assessment.threatScore}%` }}
                />
              </div>
            </div>

            {/* Forensic Reasons Cards */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>{t.indicatorsTitle}</span>
              </h4>
              <ul className="space-y-2">
                {assessment.reasons.map((r, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-3 text-xs sm:text-sm text-slate-200 bg-[#07090E]/80 p-3.5 rounded-2xl border border-white/[0.06] ${
                      lang === 'urdu' ? 'font-serif text-base' : ''
                    }`}
                  >
                    <span className="text-amber-400 font-black text-sm shrink-0 leading-none mt-1">•</span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Protective Next Steps */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t.actionsTitle}</span>
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {assessment.nextSteps.map((s, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-[#07090E]/80 p-3.5 rounded-2xl border border-white/[0.06] ${
                      lang === 'urdu' ? 'font-serif text-base' : ''
                    }`}
                  >
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Collapsible Deep Forensics & Gemma 4 Telemetry */}
            <div className="pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowDeepForensics(!showDeepForensics)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-2 transition-colors font-mono cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold">{t.deepForensics}</span>
                </span>
                {showDeepForensics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDeepForensics && (
                <div className="mt-3 space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/[0.06] space-y-1">
                      <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Google Gemma 4 AI
                      </span>
                      <p className="text-[11px] text-slate-300">
                        Verdict: <strong className="uppercase">{assessment.layerBreakdown.gemmaVerdict}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {assessment.layerBreakdown.gemmaHighlights[0] || 'Linguistic context analyzed.'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/[0.06] space-y-1">
                      <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        Pakistani Heuristics Engine
                      </span>
                      <p className="text-[11px] text-slate-300">
                        Violations: <strong>{assessment.layerBreakdown.rulesHighlights.length} rules triggered</strong>
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {assessment.layerBreakdown.rulesHighlights[0] || 'Zero blacklisted keywords found.'}
                      </p>
                    </div>
                  </div>

                  {rawOutput && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-slate-500 uppercase">Gemma 4 JSON Output Payload:</p>
                      <pre className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {rawOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3 REALISTIC SIMULATED SCENARIO CARDS (Consumer App Style) */}
        {!assessment && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.examplesTitle}</span>
              </span>
              <span className="text-[10px] text-slate-500">1-Tap Test</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* WhatsApp Fake Reversal Card */}
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    '0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein apka bhala hoga.'
                  )
                }
                className="p-3.5 text-left rounded-2xl bg-[#0B0F17]/80 hover:bg-[#101622] border border-white/[0.06] hover:border-rose-500/40 text-xs space-y-2 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    Easypaisa Scam
                  </span>
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                </div>
                <p className="text-slate-300 font-medium text-xs line-clamp-2">
                  "25,000 ghalti se bhej diye hain, maa hospital mein hai foran wapis karein..."
                </p>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition-colors block font-mono">
                  Tap to scan trap →
                </span>
              </button>

              {/* BISP Phishing Link Card */}
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'Benazir Income Support: 25,000 wazifa manzoor hua. Link par register karein: http://bisp-wazifa-claim.xyz/verify'
                  )
                }
                className="p-3.5 text-left rounded-2xl bg-[#0B0F17]/80 hover:bg-[#101622] border border-white/[0.06] hover:border-amber-500/40 text-xs space-y-2 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    BISP Phishing
                  </span>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                </div>
                <p className="text-slate-300 font-medium text-xs line-clamp-2">
                  "8171: 25,000 wazifa manzoor hua. Link par register karein: bisp-wazifa-claim.xyz"
                </p>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition-colors block font-mono">
                  Tap to unmask link →
                </span>
              </button>

              {/* Genuine Bank OTP Card */}
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP with anyone.'
                  )
                }
                className="p-3.5 text-left rounded-2xl bg-[#0B0F17]/80 hover:bg-[#101622] border border-white/[0.06] hover:border-emerald-500/40 text-xs space-y-2 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Legit Bank OTP
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-slate-300 font-medium text-xs line-clamp-2">
                  "HBL Alert: Your OTP is 591823. Valid for 5 mins. NEVER share with anyone."
                </p>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition-colors block font-mono">
                  Tap to verify safety →
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* THE LIVE HIGH-VOLTAGE INTERCEPTION POPUP MODAL (Zero-Click Threat Alert)  */}
      {/* ========================================================================= */}
      {interceptionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl p-[2px] bg-gradient-to-b from-rose-500 via-rose-600 to-amber-500 shadow-[0_0_80px_rgba(244,63,94,0.6)]">
            <div className="bg-[#0B0F17] rounded-3xl p-6 sm:p-7 space-y-5 text-slate-100">
              {/* Modal Top Alert Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30 animate-pulse">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      Live Interception
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-rose-400 tracking-tight mt-1">
                      {t.modalTitle}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInterceptionAlert(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Intercepted Snippet Box */}
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-rose-300 font-bold uppercase">
                    Source: {interceptionAlert.source === 'call' ? 'Live Phone Conversation' : 'Intercepted Clipboard / Link'}
                  </span>
                  <span className="text-amber-300 font-bold">Threat: HIGH RISK</span>
                </div>
                <blockquote className="text-xs sm:text-sm text-slate-200 italic border-l-2 border-rose-500 pl-3 leading-relaxed">
                  "{interceptionAlert.triggerSnippet}"
                </blockquote>
              </div>

              {/* High Voltage Defensive Directives */}
              <div className="p-3.5 rounded-2xl bg-[#07090E] border border-white/[0.08] space-y-2">
                <h4 className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  CRITICAL DEFENSIVE ACTION:
                </h4>
                <p className="text-xs sm:text-sm text-slate-200 font-bold leading-relaxed">
                  {interceptionAlert.recommendedAction}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Never share SMS OTP
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Never reverse money
                  </span>
                </div>
              </div>

              {/* Primary Modal Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setInterceptionAlert(null);
                    // Copy legal report
                    handleCopyComplaint();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-rose-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{t.modalHangUp}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInterceptionAlert(null);
                    // Scroll to result dossier
                    const elem = document.getElementById('security-dossier');
                    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-slate-200 font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>{t.modalViewDossier}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Minimal Footer */}
      <footer className="mt-14 text-center text-xs text-slate-500 max-w-xl px-4 space-y-1.5 font-mono relative z-10">
        <p className={lang === 'urdu' ? 'font-serif text-sm' : ''}>{t.disclaimer}</p>
        <p className="text-[11px] text-slate-600">
          Scam Shield Pakistan • Powered by Google Gemma 4 (26B-A4B-IT) • Apache 2.0 • MIT License
        </p>
      </footer>
    </main>
  );
}
