'use client';

import { useState } from 'react';
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
} from 'lucide-react';

interface AnalysisResult {
  risk: 'high' | 'medium' | 'low';
  scam_type: string;
  reasons: string[];
  next_steps: string[];
}

export default function Home() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRawOutput(null);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error occurred');
      }

      setResult(data.result);
      setRawOutput(data.raw);
    } catch (err: any) {
      setError(err.message || 'Kuch masla hua, dobara koshish karein.');
    } finally {
      setLoading(false);
    }
  };

  // Traffic Light Configuration
  const riskConfig = {
    high: {
      title: 'Bohat Khatarnak (High Risk)',
      urduSubtitle: 'Yeh message 90%+ kisi fraud ya scam ka hissa lagta hai.',
      bgColor: 'bg-rose-950/40 border-rose-600/50',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      headingColor: 'text-rose-400',
      icon: <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0" />,
      accent: 'border-rose-500',
    },
    medium: {
      title: 'Ehtiyat Karein (Medium Risk / Caution)',
      urduSubtitle: 'Kuch mashkook pehlu hain. Baghair tasdeeq koi amal na karein.',
      bgColor: 'bg-amber-950/40 border-amber-600/50',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      headingColor: 'text-amber-400',
      icon: <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />,
      accent: 'border-amber-500',
    },
    low: {
      title: 'Koi Wazeh Khatra Nahi Mila (Low Risk)',
      urduSubtitle: 'Koi fori khatra zahir nahi hua, lekin hamesha hoshiyar rahein.',
      bgColor: 'bg-emerald-950/40 border-emerald-600/50',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      headingColor: 'text-emerald-400',
      icon: <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />,
      accent: 'border-emerald-500',
    },
  };

  const currentRisk = result ? riskConfig[result.risk] : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-8">
      {/* Hackathon Badge & Header */}
      <header className="w-full max-w-3xl text-center my-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-medium tracking-wide">
          <ShieldAlert className="w-4 h-4" />
          <span>Hacktoberfest 26 Faisalabad | Gemma 4 AI</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Scam <span className="text-emerald-400">Shield</span> Pakistan
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
          Easypaisa, JazzCash, Bank ya BISP ka mashkook message ya link yahan check karein.
        </p>
      </header>

      {/* Input Card */}
      <section className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
        <form onSubmit={handleCheck} className="space-y-4">
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
              Paste suspicious SMS / WhatsApp message or link:
            </label>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. 0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein..."
              className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-transparent text-sm sm:text-base transition-all resize-y"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Powered by Google Gemma 4 (<code className="text-emerald-300 font-mono">gemma-4-26b-a4b-it</code>)
            </span>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-semibold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemma 4 is Analyzing...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Check Message (Jaanchein)</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Step 2: Traffic-Light Result Card */}
        {result && currentRisk && (
          <div className={`mt-6 border rounded-2xl p-5 sm:p-6 ${currentRisk.bgColor} transition-all space-y-6 shadow-xl`}>
            {/* Header: Traffic Light Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                {currentRisk.icon}
                <div>
                  <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${currentRisk.headingColor}`}>
                    {currentRisk.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    {currentRisk.urduSubtitle}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider ${currentRisk.badgeColor}`}>
                {result.scam_type}
              </span>
            </div>

            {/* Reasons (Wajuhat) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Khatray Ki Wajuhat (Why this was flagged):
              </h3>
              <ul className="space-y-2">
                {result.reasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-sm sm:text-base text-slate-200 bg-slate-900/60 p-3 rounded-lg border border-slate-800"
                  >
                    <span className="text-amber-400 font-bold mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Steps (Hifazati Iqdamat) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Agle Iqdamat (What you should do right now):
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.next_steps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs sm:text-sm text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800"
                  >
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Proof Dropdown (For Hackathon Judges) */}
            {rawOutput && (
              <div className="pt-2 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setShowRaw(!showRaw)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Inspect Gemma 4 Raw JSON Payload (Judges View)
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
          </div>
        )}
      </section>

      {/* Footer Disclaimer */}
      <footer className="mt-8 text-center text-xs text-slate-500 max-w-lg space-y-1">
        <p>⚠️ Yeh madad hai, final faisla nahi. / This is guidance, not a guarantee.</p>
        <p>Built with Google Gemma 4 | MLH Hacktoberfest Faisalabad | MIT License</p>
      </footer>
    </main>
  );
}
