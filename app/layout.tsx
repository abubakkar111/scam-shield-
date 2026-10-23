import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scam Shield Pakistan | Gemma 4 AI Scam Detector',
  description: 'Detect SMS, WhatsApp, Easypaisa, JazzCash, and banking scams in Roman Urdu using Gemma 4 open-weight AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
