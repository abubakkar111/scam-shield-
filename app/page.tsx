'use client';

import { useState } from 'react';
import { ShieldAlert, Send, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

export default function Home() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [rawResult, setRawResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setRawResult(null);

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

      setRawResult(data.raw);
    } catch (err: any) {
      setError(err.message || 'Kuch masla hua, dobara koshish karein.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex flex-col items-center p-4 sm:p-8">
      {/* Header */}
      <div className="w-full max-w-3xl text-center my-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-medium tracking-wide">
          <ShieldAlert className="w-4 h-4" />
          <span>Hacktoberfest 26 Faisalabad | Gemma 4 Powered</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Scam <span className="text-emerald-400">Shield</span> Pakistan
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
          Easypaisa, JazzCash, bank ya BISP ka mashkook message ya link yahan check karein.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="w-full max-w-3xl bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
        <form onSubmit={handleCheck} className="space-y-4">
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
              Paste suspicious SMS / WhatsApp message or link:
            </label>
            <textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. 0300-1234567 se 25,000 ghalti se bhej diye hain, baraye meharbani wapis bhej dein..."
              className="w-full p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-transparent text-sm sm:text-base transition-all resize-y"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Powered by Google Gemma 4 (<code className="text-emerald-300">gemma-4-26b-a4b-it</code>)
            </span>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-slate-950 disabled:text-slate-400 font-semibold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Checking with Gemma 4...</span>
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

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Raw Output Display */}
        {rawResult && (
          <div className="mt-6 pt-6 border-t border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Step 1: Raw Gemma 4 Output
              </h3>
              <span className="text-xs px-2.5 py-1 rounded bg-slate-900 text-slate-400 font-mono">
                JSON Response
              </span>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {rawResult}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Disclaimer */}
      <footer className="mt-8 text-center text-xs text-slate-500 max-w-lg space-y-1">
        <p>⚠️ Yeh madad hai, final faisla nahi. / This is guidance, not a guarantee.</p>
        <p>Built for Hacktoberfest 26 Faisalabad | MIT Open Source</p>
      </footer>
    </main>
  );
}
