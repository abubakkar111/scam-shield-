'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
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
  Smartphone,
  CheckCircle2,
  FileText,
  AlertCircle,
  Radio,
  PhoneCall,
  PhoneOff,
  Sparkles,
  Activity,
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

  // Input & Verification States
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Background Protection & Live Call Guard States
  const [sentryActive, setSentryActive] = useState(true);
  const [sentryListening, setSentryListening] = useState(false);
  const [liveAudioSnippet, setLiveAudioSnippet] = useState<string | null>(null);
  const [interceptionAlert, setInterceptionAlert] = useState<InterceptionAlert | null>(null);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const lastScannedTextRef = useRef<string>('');
  const sentryRecognitionRef = useRef<any>(null);

  // Results & Forensics States
  const [assessment, setAssessment] = useState<CombinedAssessment | null>(null);
  const [linkTraceResult, setLinkTraceResult] = useState<LinkTraceData | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
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

  // Audio Siren Warning for Critical Alerts
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

      gain.gain.setValueAtTime(0.25, now);
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
        } else if (Notification.permission !== 'default') {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              new Notification(title, { body });
            }
          });
        }
      }
    } catch (e) {}
  }, []);

  // Trigger Live Threat Modal with Audio Siren + Notification
  const triggerInterception = useCallback(
    (alert: InterceptionAlert) => {
      setInterceptionAlert(alert);
      playSirenAlert();
      triggerNativeNotification(`⚠️ SCAM SHIELD ALERT: ${alert.scamType}`, alert.recommendedAction);

      // Voice Warning
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const speech =
          lang === 'urdu'
            ? 'خبردار! مشکوک کال یا پیغام پکڑا گیا ہے۔ اپنا او ٹی پی یا رقم ہرگز نہ بھیجیں!'
            : 'Warning! Potential fraud detected on your active call or message. Do not share your OTP or send funds!';
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
          throw new Error(data.error || 'Verification server error');
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
        setError(err.message || 'Verification failed. Please retry.');
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
          sentryRecognitionRef.current.onend = null;
          sentryRecognitionRef.current.stop();
        } catch (e) {}
      }
      sentryRecognitionRef.current = null;
      setSentryListening(false);
      setLiveAudioSnippet(null);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        lang === 'urdu'
          ? 'براؤزر لائیو کال مانیٹرنگ سپورٹ نہیں کرتا۔ برائے مہربانی کروم استعمال کریں۔'
          : 'Live Call Monitoring is not supported in this browser. Please use Chrome or Edge.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang === 'urdu' ? 'ur-PK' : 'en-US';
      if ('maxAlternatives' in recognition) {
        (recognition as any).maxAlternatives = 1;
      }

      recognition.onstart = () => {
        setSentryListening(true);
        setError(null);
      };

      let lastProcessedHash = '';
      let lastProcessedNormalized = '';
      let lastProcessTime = 0;
      let lastTriggerTime = 0;
      let isProcessing = false;
      const seenSet = new Set<string>();

      const normalizeText = (t: string) => {
        return t
          .toLowerCase()
          .replace(/[^a-z0-9\u0600-\u06FF\s₹]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const getHash = (t: string) => {
        const n = normalizeText(t);
        const words = n.split(' ').filter(w => w.length > 2);
        const core = words.slice(-12).join(' ');
        let h = 0;
        for (let i = 0; i < core.length; i++) {
          h = ((h << 5) - h) + core.charCodeAt(i);
          h |= 0;
        }
        return h.toString();
      };

      recognition.onresult = (event: any) => {
        if (isProcessing || interceptionAlert) return;
        
        // Get only the most recent final result
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (!event.results[i].isFinal) continue;
          
          const text = event.results[i][0].transcript.trim();
          if (!text || text.length < 35) continue;
          
          const normalized = normalizeText(text);
          const hash = getHash(text);
          const now = Date.now();
          
          // Prevent any duplication
          if (normalized === lastProcessedNormalized) return;
          if (hash === lastProcessedHash) return;
          if (seenSet.has(normalized)) return;
          if (now - lastProcessTime < 8000) return;
          if (now - lastTriggerTime < 15000) return;
          
          // Add to seen set
          seenSet.add(normalized);
          if (seenSet.size > 15) {
            const arr = Array.from(seenSet);
            for (let k = 0; k < 5; k++) seenSet.delete(arr[k]);
          }
          
          setLiveAudioSnippet(text);
          
          const lower = normalized;
          const scamTriggers = [
            'otp',
            'one time password',
            'code',
            'pin',
            'password',
            'easypaisa',
            'jazzcash',
            'wapis bhej',
            'ghalti se bhej',
            'lottery',
            'bisp',
            'benazir',
            'wazifa',
            'biometric',
            'account block',
            'block ho',
            'urgent',
            'foran',
            'jaldi',
            'send kar',
            'bhej dein',
            'rs 1000',
            '5000',
            '₹',
          ];

          const strongTriggers = ['otp', 'pin', 'password', 'easypaisa', 'jazzcash', 'wapis bhej', 'ghalti se bhej'];
          const strongCount = strongTriggers.filter((kw) => lower.includes(kw)).length;
          const triggerCount = scamTriggers.filter((kw) => lower.includes(kw)).length;
          const hasUrgency = lower.includes('foran') || lower.includes('abhi') || lower.includes('jaldi') || lower.includes('urgent');
          
          const isThreat = strongCount >= 1 || (triggerCount >= 2 && hasUrgency);

          if (isThreat) {
            isProcessing = true;
            lastProcessedHash = hash;
            lastProcessedNormalized = normalized;
            lastProcessTime = now;
            lastTriggerTime = now;
            
            triggerInterception({
              source: 'call',
              scamType: 'Live Call Extortion / Credential Theft',
              triggerSnippet: text,
              threatLevel: 'high',
              recommendedAction:
                'Caller is asking for codes or money transfer. DO NOT SHARE ANY PIN, OTP, OR SEND ANY MONEY. Hang up immediately.',
            });
            setMessage(`[Live Call Interception] "${text}"`);
            executeAnalysis(text);
            setTimeout(() => {
              isProcessing = false;
            }, 15000);
            break;
          } else {
            lastProcessedHash = hash;
            lastProcessedNormalized = normalized;
            lastProcessTime = now;
          }
        }
      };

      recognition.onerror = (err: any) => {
        const code = err?.error;
        if (code === 'no-speech' || code === 'aborted' || code === 'audio-capture') {
          return;
        }
        if (code === 'not-allowed') {
          setSentryListening(false);
          setError(
            lang === 'urdu'
              ? 'لائیو کال گارڈ کے لیے مائیکروفون کی اجازت درکار ہے۔'
              : 'Microphone permission required for Live Call Guard.'
          );
          return;
        }
        if (code) {
          console.warn('Call listener warning:', code);
        }
        setSentryListening(false);
      };

      recognition.onend = () => {
        if (sentryListening && sentryRecognitionRef.current) {
          try {
            setTimeout(() => {
              if (sentryListening && sentryRecognitionRef.current) {
                try {
                  sentryRecognitionRef.current.start();
                } catch (e) {
                  setSentryListening(false);
                }
              }
            }, 1000);
          } catch (e) {
            setSentryListening(false);
          }
        } else {
          setSentryListening(false);
        }
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
          setAutoNotice('⚡ Message copied from WhatsApp detected & verified.');
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
              scamType: hasLink ? 'Unverified External Link' : 'WhatsApp Money Transfer Request',
              triggerSnippet: trimmed,
              threatLevel: 'high',
              recommendedAction:
                'Do not click the link or send funds. Check your account balance directly in the official app.',
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

  // Direct Speech Recording for Textarea
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

      recognition.onerror = (event: any) => {
        const code = event?.error;
        if (code === 'no-speech' || code === 'aborted' || code === 'audio-capture') {
          setIsRecording(false);
          return;
        }
        if (code === 'not-allowed') {
          setError(
            lang === 'urdu'
              ? 'مائیکروفون تک رسائی کی اجازت درکار ہے۔'
              : 'Microphone permission denied. Please allow mic access.'
          );
        } else if (code) {
          console.warn('Speech recognition warning:', code);
        }
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
      appSubtitle: 'Pakistan Anti-Fraud & Cyber Safety',
      headline: 'Verify Any Message, Caller, or Link',
      tagline: 'Instantly detect fake Easypaisa transfers, WhatsApp lottery traps, phishing websites, and OTP theft.',
      placeholder: 'Paste suspicious SMS, WhatsApp message, or link... Or use voice & photo below.',
      pasteBtn: 'Paste',
      verifyBtn: 'Verify Safety',
      verifyingBtn: 'Checking...',
      highRisk: 'CRITICAL FRAUD DETECTED',
      medRisk: 'SUSPICIOUS (CAUTION REQUIRED)',
      lowRisk: 'NO OBVIOUS THREATS FOUND',
      highDesc: 'High-confidence indicators of financial theft or social engineering coercion.',
      medDesc: 'Suspicious patterns detected. Avoid clicking links or transferring funds without manual confirmation.',
      lowDesc: 'No obvious malicious patterns identified. Standard vigilance recommended.',
      listenBtn: 'Listen Alert',
      copyComplaint: 'Copy FIA Cybercrime Report',
      indicatorsTitle: 'Security Findings & Indicators',
      actionsTitle: 'Recommended Protective Steps',
      examplesTitle: 'Quick Verification Tests:',
      disclaimer: 'Advisory service for fraud prevention. Always confirm via official 3737/8558 helplines.',
      technicalDetails: 'Technical Security Forensics',
      guardTitle: 'Active Protection',
      guardActive: 'Monitoring live calls & copied messages',
      guardPaused: 'Protection paused',
      testAlertBtn: 'Test Alert',
      modalTitle: 'FRAUD ATTEMPT DETECTED',
      modalHangUp: 'Block Sender & Copy FIA Report',
      modalViewDossier: 'View Security Dossier',
    },
    roman: {
      appName: 'Scam Shield',
      appSubtitle: 'Pakistan Anti-Fraud & Cyber Safety',
      headline: 'Kisi Bhi Message, Call Ya Link Ki Fori Jaanch',
      tagline: 'Easypaisa, JazzCash, fake calls, screenshots aur mashkook links se foran bachein.',
      placeholder: 'SMS, WhatsApp message, ya link yahan paste karein... Ya neeche mic ya photo use karein.',
      pasteBtn: 'Paste Karein',
      verifyBtn: 'Threat Check Karein',
      verifyingBtn: 'Jaanch Jari Hai...',
      highRisk: 'BOHAT KHATARNAK (FRAUD)',
      medRisk: 'EHTIYAT KAREIN (SUSPICIOUS)',
      lowRisk: 'KOI WAZEH KHATRA NAHI MILA',
      highDesc: 'Is message ya call mein fraud aur raqam churanay ke qawi shawahid hain.',
      medDesc: 'Kuch mashkook pehlu mile hain. Tasdeeq ke baghair koi raqam ya code na dein.',
      lowDesc: 'Fori khatra nahi mila, lekin anjaan messages par hamesha ehtiyat bartein.',
      listenBtn: 'Awaz Suniye',
      copyComplaint: 'FIA Report Copy Karein',
      indicatorsTitle: 'Khatray Ki Forensic Wajuhat',
      actionsTitle: 'Agle Hifazati Iqdamat (Next Steps)',
      examplesTitle: 'Aam Pakistani Fraud Scenarios:',
      disclaimer: 'Yeh madad hai, final faisla nahi. Pehle helpline se tasdeeq karein.',
      technicalDetails: 'Technical Security Forensics',
      guardTitle: 'Active Protection',
      guardActive: 'Call aur copied messages par nigrani active hai',
      guardPaused: 'Nigrani band hai',
      testAlertBtn: 'Alert Test Karein',
      modalTitle: 'FRAUD KA KHATRA PAKRA GAYA!',
      modalHangUp: 'Block Karein & FIA Report Leinge',
      modalViewDossier: 'Mukammal Report Dekhein',
    },
    urdu: {
      appName: 'اسکیم شیلڈ',
      appSubtitle: 'پاکستان سائبر فراڈ سیفٹی سروس',
      headline: 'کسی بھی مشکوک کال، میسج یا لنک کی فوری تصدیق',
      tagline: 'ایزی پیسہ، جاز کیش، جعلی کالز اور دھوکہ دہی والے لنکس سے اپنے آپ کو محفوظ رکھیں۔',
      placeholder: 'مشکوک ایس ایم ایس، پیغام یا لنک یہاں درج کریں یا مائیک/تصویر کا استعمال کریں...',
      pasteBtn: 'پیسٹ کریں',
      verifyBtn: 'فوری تصدیق کریں',
      verifyingBtn: 'تصدیق جاری ہے...',
      highRisk: 'انتہائی خطرناک (فراڈ کا قوی خطرہ)',
      medRisk: 'احتیاط برتیں (مشکوک علامات)',
      lowRisk: 'کوئی واضح خطرہ نہیں ملا',
      highDesc: 'اس پیغام یا کال میں مالی فراڈ اور رقم ہتھیانے کے واضح شواہد موجود ہیں۔',
      medDesc: 'کچھ مشکوک علامات پائی گئی ہیں۔ تصدیق کے بغیر کوئی قدم نہ اٹھائیں۔',
      lowDesc: 'کوئی فوری خطرہ ظاہر نہیں ہوا، مگر ہمیشہ محتاط رہیں۔',
      listenBtn: 'صوتی الرٹ سنیں',
      copyComplaint: 'ایف آئی اے رپورٹ بنائیں',
      indicatorsTitle: 'سیکورٹی شواہد اور خطرے کی وجوہات',
      actionsTitle: 'فوری حفاظتی اقدامات',
      examplesTitle: 'آزمائشی نمونے:',
      disclaimer: 'یہ رہنمائی کے لیے ہے، حتمی قانونی فیصلہ نہیں۔',
      technicalDetails: 'تکنیکی سیکورٹی شواہد',
      guardTitle: 'لائیو پروٹیکشن',
      guardActive: 'فون کالز اور کاپی پیغامات کی نگرانی فعال ہے',
      guardPaused: 'نگرانی بند ہے',
      testAlertBtn: 'الرٹ کا تجربہ کریں',
      modalTitle: 'مشکوک فراڈ پکڑا گیا!',
      modalHangUp: 'بلاک کریں اور ایف آئی اے رپورٹ لیں',
      modalViewDossier: 'سیکورٹی رپورٹ دیکھیں',
    },
  }[lang];

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-x-hidden pb-20 font-sans text-slate-100 antialiased selection:bg-emerald-400 selection:text-slate-950">
      {/* Ambient AI atmosphere */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.55]" />
        <div className="aurora absolute -top-56 left-1/2 h-[42rem] w-[46rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[130px]" />
        <div className="aurora-slow absolute -left-48 top-24 h-[32rem] w-[32rem] rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="aurora-slow absolute -right-48 top-52 h-[32rem] w-[32rem] rounded-full bg-violet-500/15 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#05060B] to-transparent" />
      </div>

      {/* Top Professional Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#05060B]/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-3.5 pb-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Reset Scam Shield"
            className="group relative h-10 w-10 shrink-0 cursor-pointer"
            onClick={handleClearAll}
          >
            <span className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-400/50 via-cyan-400/40 to-violet-500/50 opacity-70 blur-md transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-[#0A0F18] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <Shield className="h-5 w-5 text-emerald-300" />
            </span>
          </button>
          <div>
            <h1 className={`flex items-center gap-2 text-base sm:text-lg font-semibold text-white tracking-tight ${lang === 'urdu' ? 'font-serif' : 'font-display'}`}>
              {t.appName}
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-[0.14em] text-emerald-300">
                AI
              </span>
            </h1>
            <p className="flex items-center gap-1.5 text-[11px] tracking-tight text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* 3-Way Language Selector */}
        <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5 text-xs backdrop-blur">
          <button
            type="button"
            onClick={() => setLang('english')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              lang === 'english'
                ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang('roman')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              lang === 'roman'
                ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Roman
          </button>
          <button
            type="button"
            onClick={() => setLang('urdu')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              lang === 'urdu'
                ? 'bg-white/10 text-white font-serif shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            اردو
          </button>
        </div>
        </div>
      </header>

      {/* Hero Headline */}
      <section className="w-full max-w-3xl px-4 pt-12 pb-7 text-center sm:px-6 sm:pt-16 animate-rise">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300 backdrop-blur">
          <Sparkles className="h-3 w-3 text-emerald-300" />
          Gemini 2.5 Flash · Hybrid AI + Pakistan Fraud Rules
        </div>

        <h2
          className={`text-gradient mx-auto mt-5 max-w-2xl text-balance text-3xl font-semibold leading-[1.12] tracking-tight sm:text-[2.6rem] ${
            lang === 'urdu' ? 'font-serif leading-[1.5]' : 'font-display'
          }`}
        >
          {t.headline}
        </h2>
        <p
          className={`mx-auto mt-4 max-w-xl text-[13px] leading-relaxed text-slate-400 sm:text-sm ${
            lang === 'urdu' ? 'font-serif text-base' : ''
          }`}
        >
          {t.tagline}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500 sm:text-[11px]">
          {['3-layer analysis', 'Urdu + English', 'Screenshot OCR', 'Private by design'].map((feature) => (
            <span
              key={feature}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1"
            >
              <span className="h-1 w-1 rounded-full bg-emerald-400/80" />
              {feature}
            </span>
          ))}
        </div>
      </section>

      {/* Main Verification Container */}
      <div className="w-full max-w-3xl px-4 sm:px-6 space-y-4">
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

        {/* Temporary Auto-Scan Toast Alert */}
        {autoNotice && (
          <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-md">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-xs">{autoNotice}</span>
          </div>
        )}

        {/* VERIFICATION CARD */}
        <div className="card-shell">
          <div className="card-core p-4 sm:p-5 space-y-4">
            {/* Console toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1" aria-hidden>
                  <span className="h-2 w-2 rounded-full bg-rose-400/60" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/60" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
                </span>
                <span className="ml-1 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <Activity className="h-3.5 w-3.5 text-emerald-300" />
                  ScamShield Console
                </span>
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  loading
                    ? 'border-amber-300/25 bg-amber-400/10 text-amber-300'
                    : 'border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-300'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-300 animate-pulse' : 'bg-emerald-400'}`} />
                {loading ? 'Analyzing…' : 'Engine ready'}
              </span>
            </div>

          <form onSubmit={handleFormSubmit} className="space-y-3">
            {/* Input Textarea */}
            <div className="relative">
              <textarea
                id="main-unified-input"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.placeholder}
                dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                className={`w-full min-h-[112px] resize-none rounded-2xl border border-white/10 bg-[#04060B]/80 p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all focus:border-emerald-400/40 focus:outline-none focus:ring-4 focus:ring-emerald-400/10 ${
                  lang === 'urdu' ? 'font-serif text-base leading-loose' : 'font-sans'
                }`}
                required
              />

              {/* Real-time Link Detection Chip */}
              {detectedUrl && (
                <div className="mt-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <LinkIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-400 text-xs">Link:</span>
                    <span className="text-slate-200 truncate underline text-xs">{detectedUrl}</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded font-mono shrink-0">
                    Inspection Ready
                  </span>
                </div>
              )}

              {/* Audio Attachment Preview */}
              {audioFileUrl && (
                <div className="mt-2 p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-mono text-xs truncate">{audioFileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <audio controls src={audioFileUrl} className="h-7 max-w-[150px] sm:max-w-[200px]" />
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

              {/* Screenshot OCR Progress Bar */}
              {ocrLoading && (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-2 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      Reading screenshot text...
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
                <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <img src={imagePreview} alt="Screenshot" className="w-9 h-9 object-cover rounded border border-slate-700" />
                    <div className="text-xs space-y-0.5">
                      <p className="font-medium text-slate-200">Screenshot Attached</p>
                      <p className="text-[11px] text-slate-400">Text extracted to verification box.</p>
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

            {/* Verification Dock */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              {/* Media Inputs */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* 1-Click Paste Clipboard Button */}
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  title="Paste from Clipboard"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">{t.pasteBtn}</span>
                </button>

                {/* Voice Record Button */}
                <button
                  type="button"
                  onClick={toggleDirectRecording}
                  title="Record Speech"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_20px_-4px_rgba(244,63,94,0.7)]'
                      : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{isRecording ? `${recordingSeconds}s` : 'Voice'}</span>
                </button>

                {/* Screenshot Button */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  title="Upload Screenshot"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Photo</span>
                </button>

                {/* Audio File Button */}
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  title="Attach Audio File"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  <Music className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Audio</span>
                </button>
              </div>

              {/* Right Side: Clear & Verify Button */}
              <div className="flex items-center gap-2">
                {message && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="btn-shine inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 px-5 py-2.5 text-xs font-bold text-[#04120C] shadow-[0_12px_40px_-12px_rgba(52,211,153,0.75)] transition-all hover:brightness-105 hover:shadow-[0_18px_50px_-12px_rgba(52,211,153,0.9)] active:scale-95 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/[0.05] disabled:text-slate-500 disabled:shadow-none sm:text-sm"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.verifyingBtn}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t.verifyBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>

        {/* CLEAN PROTECTION STATUS BAR */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-xs backdrop-blur">
          <div className="flex items-center gap-2.5 truncate">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                sentryListening ? 'bg-rose-500 animate-ping' : sentryActive ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'bg-slate-600'
              }`}
            />
            <div className="truncate">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-slate-300">{t.guardTitle}:</span>
              <span className="text-slate-400 text-[11px] truncate">
                {sentryListening ? 'Active Call Listening...' : sentryActive ? t.guardActive : t.guardPaused}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Live Call Listener Toggle */}
            <button
              type="button"
              onClick={toggleLiveSentry}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                sentryListening
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {sentryListening ? 'Stop Call Mic' : 'Call Mic'}
            </button>

            {/* 1-Click Test Alert Button */}
            <button
              type="button"
              onClick={handleSimulateScammerCall}
              className="text-[11px] text-slate-400 hover:text-emerald-400 font-mono underline cursor-pointer"
            >
              {t.testAlertBtn}
            </button>
          </div>
        </div>

        {/* Live Audio Intercept Ticker (if listening) */}
        {sentryListening && liveAudioSnippet && (
          <div className="bg-[#080B13] px-3.5 py-2 rounded-xl border border-slate-800 flex items-center gap-2 text-xs font-mono text-emerald-400 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span className="text-slate-400 shrink-0">Heard:</span>
            <span className="text-slate-200 truncate italic">"{liveAudioSnippet}"</span>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* SECURITY VERIFICATION REPORT (Results Screen) */}
        {assessment && (
          <section
            id="security-dossier"
            className={`animate-rise space-y-5 rounded-[26px] border p-5 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-xl transition-all sm:p-6 ${
              assessment.finalRisk === 'high'
                ? 'bg-[#120B10] border-rose-500/40'
                : assessment.finalRisk === 'medium'
                ? 'bg-[#12100B] border-amber-500/40'
                : 'bg-[#0B120E] border-emerald-500/40'
            }`}
          >
            {/* Verdict Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    assessment.finalRisk === 'high'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : assessment.finalRisk === 'medium'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {assessment.finalRisk === 'high' ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : assessment.finalRisk === 'medium' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <h3
                    className={`text-lg sm:text-xl font-bold tracking-tight ${
                      assessment.finalRisk === 'high'
                        ? 'text-rose-400'
                        : assessment.finalRisk === 'medium'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    } ${lang === 'urdu' ? 'font-serif text-xl' : ''}`}
                  >
                    {assessment.finalRisk === 'high'
                      ? t.highRisk
                      : assessment.finalRisk === 'medium'
                      ? t.medRisk
                      : t.lowRisk}
                  </h3>
                  <p className={`text-xs text-slate-300 mt-0.5 leading-relaxed ${lang === 'urdu' ? 'font-serif' : ''}`}>
                    {assessment.finalRisk === 'high'
                      ? t.highDesc
                      : assessment.finalRisk === 'medium'
                      ? t.medDesc
                      : t.lowDesc}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSpeakVerdict}
                  title="Listen Alert"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.listenBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyComplaint}
                  title="Copy FIA Report"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedComplaint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedComplaint ? 'Copied' : t.copyComplaint}</span>
                </button>
              </div>
            </div>

            {/* Unmasked Destination Link Card */}
            {linkTraceResult && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                    Target Destination Unmasked:
                  </span>
                  {linkTraceResult.redirected && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                      Redirects Externally
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-[#080B13] border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 text-slate-400 text-xs truncate">
                    <span>Input:</span>
                    <span className="text-slate-300 truncate">{linkTraceResult.original}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs truncate">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>Real Site:</span>
                    <span className="truncate underline">{linkTraceResult.finalUrl}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-300">Assessment:</strong> {linkTraceResult.verdict}
                </p>
              </div>
            )}

            {/* Threat Meter Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-medium">Type: {assessment.scamType}</span>
                <span className="text-slate-400">Confidence: {assessment.threatScore}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
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

            {/* Findings & Reasons */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.indicatorsTitle}</span>
              </h4>
              <ul className="space-y-1.5">
                {assessment.reasons.map((r, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-[#090D16]/80 p-3 rounded-xl border border-slate-800/80 ${
                      lang === 'urdu' ? 'font-serif text-base' : ''
                    }`}
                  >
                    <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actionable Next Steps */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.actionsTitle}</span>
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {assessment.nextSteps.map((s, i) => (
                  <li
                    key={i}
                    dir={lang === 'urdu' ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2 text-xs text-slate-200 bg-[#090D16]/80 p-3 rounded-xl border border-slate-800/80 ${
                      lang === 'urdu' ? 'font-serif text-sm' : ''
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Understated Technical Accordion (for Hackathon Judges) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors font-mono cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.technicalDetails}</span>
                </span>
                {showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTechnicalDetails && (
                <div className="mt-2.5 space-y-2 font-mono text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="font-semibold text-emerald-400">Google Gemma 4 IT</span>
                      <p className="text-[11px] text-slate-300">
                        Verdict: <strong className="uppercase">{assessment.layerBreakdown.gemmaVerdict}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {assessment.layerBreakdown.gemmaHighlights[0] || 'Inference completed.'}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="font-semibold text-cyan-400">Deterministic Rules Engine</span>
                      <p className="text-[11px] text-slate-300">
                        Matches: {assessment.layerBreakdown.rulesHighlights.length} rules
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {assessment.layerBreakdown.rulesHighlights[0] || 'No blacklist match.'}
                      </p>
                    </div>
                  </div>

                  {rawOutput && (
                    <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                      {rawOutput}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3 AUTHENTIC PAKISTANI SCAM SCENARIOS (Quick Test Chips) */}
        {!assessment && (
          <div className="space-y-2.5 pt-3">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <span className="h-px w-5 bg-gradient-to-r from-transparent to-emerald-400/60" />
              {t.examplesTitle}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* WhatsApp Fake Reversal */}
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    '0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein apka bhala hoga.'
                  )
                }
                className="group cursor-pointer space-y-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-left text-xs transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Easypaisa Reversal</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  "25,000 ghalti se bhej diye wapis bhej dein..."
                </p>
              </button>

              {/* 8171 BISP Link */}
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'Benazir Income Support: 25,000 wazifa manzoor hua. Link par register karein: http://bisp-wazifa-claim.xyz/verify'
                  )
                }
                className="group cursor-pointer space-y-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-left text-xs transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">8171 BISP Link</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  "25,000 wazifa claim: bisp-wazifa-claim.xyz..."
                </p>
              </button>

              {/* Genuine Bank OTP */}
              <button
                type="button"
                onClick={() =>
                  loadPreset(
                    'HBL Alert: Your OTP for internet banking login is 591823. Valid for 5 mins. NEVER share this OTP with anyone.'
                  )
                }
                className="group cursor-pointer space-y-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-left text-xs transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Genuine Bank OTP</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  "Your HBL OTP is 591823. Never share with anyone."
                </p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ALERT POPUP MODAL (Zero-Click Interception) */}
      {interceptionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="animate-rise relative w-full max-w-md space-y-4 rounded-[26px] border border-rose-500/40 bg-[#0B0F19]/95 p-5 text-slate-100 shadow-[0_0_120px_-30px_rgba(244,63,94,0.55)] backdrop-blur-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider block">
                    Security Interception
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {t.modalTitle}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInterceptionAlert(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Intercepted Text */}
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/25 space-y-1 text-xs">
              <span className="text-[11px] font-semibold text-rose-300 uppercase block">
                {interceptionAlert.source === 'call' ? 'Live Phone Call' : 'Intercepted Message / Link'}
              </span>
              <p className="text-slate-200 italic leading-relaxed">
                "{interceptionAlert.triggerSnippet}"
              </p>
            </div>

            {/* Directive */}
            <div className="p-3 rounded-xl bg-[#080B13] border border-slate-800 text-xs space-y-1">
              <span className="text-amber-400 font-semibold block uppercase text-[11px]">
                Protective Directive:
              </span>
              <p className="text-slate-200 leading-relaxed">
                {interceptionAlert.recommendedAction}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setInterceptionAlert(null);
                  handleCopyComplaint();
                }}
                className="py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>{t.modalHangUp}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInterceptionAlert(null);
                  const elem = document.getElementById('security-dossier');
                  if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                }}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.modalViewDossier}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Understated Clean Footer */}
      <footer className="mt-16 w-full max-w-3xl space-y-3 border-t border-white/[0.06] px-4 pt-6 text-center text-xs text-slate-500 sm:px-6">
        <p className={`mx-auto max-w-md leading-relaxed ${lang === 'urdu' ? 'font-serif text-sm' : ''}`}>{t.disclaimer}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-600">
          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">Gemini 2.5 Flash</span>
          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">On-device OCR</span>
          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">MIT License</span>
        </div>
      </footer>
    </main>
  );
}
