import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scam Shield Pakistan • AI Cyber Defense & Scam Intelligence',
  description:
    'Instant forensic analysis for SMS, WhatsApp fraud, fake Easypaisa/JazzCash transfers, phishing links, and voice notes powered by Google Gemma 4.',
  keywords: [
    'Scam Shield',
    'Pakistan Scam Detector',
    'Easypaisa Fraud',
    'JazzCash Scam',
    'FIA Cybercrime',
    'Google Gemma 4',
    'Roman Urdu AI',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#05060B] text-slate-100 min-h-screen selection:bg-emerald-400 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
