# 🛡️ Scam Shield Pakistan
### AI-Powered Cyber Fraud & Social Engineering Defense for Pakistan using Google Gemma 4

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![AI Model: Gemma 4](https://img.shields.io/badge/AI%20Model-Google%20Gemma%204%20(26B--A4B--IT)-blue.svg)](https://ai.google.dev/gemma)
[![Gemma License: Apache 2.0](https://img.shields.io/badge/Model%20License-Apache%202.0-orange.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Hackathon: Hacktoberfest 26 Faisalabad](https://img.shields.io/badge/MLH%20Hack%20Day-Faisalabad%20x%20HimmatKaar-purple.svg)](https://events.mlh.com)

> **"Our app helps ordinary Pakistanis check suspicious messages, screenshots, and links in Roman Urdu and Urdu script using Google Gemma 4."**

---

## 🎯 Challenges Targeted (Hacktoberfest 26 Faisalabad)
1. **Best Use of Gemma 4**: Powered directly by Google's open-weight model **`gemma-4-26b-a4b-it`**, called through the official `@google/genai` Node.js SDK via the Gemini API.
2. **Best Open-Source AI Project**: 100% open-source repository licensed under **MIT**, utilizing Google's open-weight Gemma 4 model (licensed under **Apache 2.0**).

---

## 🇵🇰 The Real-World Problem in Pakistan
Every single day, millions of citizens across Pakistan—students, mothers, shopkeepers, and elders—receive malicious fraud attempts through SMS and WhatsApp:
- **Accidental Wallet Reversal**: *"Bhai ghalti se 25,000 aapke Easypaisa / JazzCash par bhej diye hain, wapis kar dein warna police report hogi."*
- **Fake Government Grants**: *"Benazir Income Support (BISP) / Ehsaas: Aapka 25,000 wazifa agaya hai, click karein."*
- **Credential & OTP Theft**: Fake bank calls impersonating HBL, UBL, or Meezan Bank demanding secret OTPs or card numbers.
- **Phishing & Lookalike Domains**: Deceptive links like `easypaisa-reward.xyz` or `jazzcash-claim.click` designed to steal logins.

Standard English cybersecurity tools fail completely because **Pakistani scammers communicate in Roman Urdu and colloquial slang**.

---

## ⚡ Architecture: The 3-Layer Hybrid SOC Engine

```
                             [ Suspicious SMS / WhatsApp / Screenshot ]
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │       On-Device OCR (Tesseract.js)    │
                             └───────────────────┬───────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
             ┌─────────────────────────┐                       ┌─────────────────────────┐
             │      Layer 1: AI        │                       │    Layer 2: Rules       │
             │     Google Gemma 4      │                       │  Cybersecurity Engine   │
             │  (gemma-4-26b-a4b-it)   │                       │  (50+ Pakistani Heuristics)
             │                         │                       │                         │
             │ • Roman Urdu Context    │                       │ • Phishing Domains (.xyz)
             │ • Urgency & Fear Index  │                       │ • Brand Typosquatting   │
             │ • Social Engineering    │                       │ • URL Shortener Bypasser│
             └──────────┬──────────────┘                       └───────────┬─────────────┘
                        │                                                  │
                        └────────────────────────┬─────────────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │       Layer 3: Hybrid Combiner        │
                             │       (Conservative Threat Model)     │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                                     [ Traffic-Light Assessment ]
                                     🔴 Bohat Khatarnak (High Risk)
                                     🟡 Ehtiyat Karein (Medium Risk)
                                     🟢 Koi Wazeh Khatra Nahi Mila
```

### 1. Gemma 4 AI Layer (`gemma-4-26b-a4b-it`)
Calls Google's open-weight Gemma 4 model via the official `@google/genai` SDK. Analyzes contextual nuance, emotional manipulation, urgency, and fear tactics in Roman Urdu and Urdu script.

### 2. Heuristic Rules Engine (`lib/rules.ts`)
A zero-latency deterministic cybersecurity engine checking:
- **50+ Pakistani Fraud Phrases**: "ghalti se paise", "wapis bhej", "inam", "lottery", "account block", "otp share", "advance fee".
- **Link & Domain Inspection**: URL shorteners (`bit.ly`, `tinyurl`), brand typosquatting (`easypaisa-*.xyz`, `jazzcash-*.click`), IP-address links, and suspicious TLDs (`.xyz`, `.top`, `.click`, `.buzz`).

### 3. Conservative Hybrid Combiner (`lib/combine.ts`)
If **either** engine detects a critical threat, the final verdict escalates to High Risk. If the AI is uncertain but heuristic rules trigger, the threat level is raised to Medium. Displays transparent "Which layer caught what" explainability.

---

## 🚀 Key Features
- **Tri-Lingual Support**: Instant 1-click toggle between **English**, **Roman Urdu**, and **Urdu Script (اردو رسم الخط)** with full RTL styling.
- **Pre-Click Link Destination Tracer**: Safely resolves shortened URLs (`bit.ly`, `tinyurl`) and traces redirects server-side before the user clicks, unmasking lookalike phishing domains (`.xyz`, `.click`, typosquats).
- **Voice Call & WhatsApp Audio Note Analysis**: Live microphone speech recording **plus** audio file selection from device gallery/storage (`.mp3`, `.wav`, `.m4a`), with built-in simulated Pakistani scam calls.
- **Screenshot / Photo OCR**: Upload or drag-and-drop screenshots of SMS or WhatsApp chats. In-browser OCR extracts text automatically before AI analysis.
- **1-Click FIA Cybercrime (NR3C) / Bank Complaint Generator**: Automatically formats a ready-to-file legal complaint draft in Urdu or English with victim instructions.
- **1-Click Pakistani Test Scenarios**: Demo-ready scenarios (Accidental transfer, BISP phishing, Genuine bank OTP).
- **Graceful Fail-Safe**: If internet connectivity is interrupted, the app automatically falls back to the deterministic local rules engine.
- **Judges Deep-Dive Accordion**: Collapsible raw JSON inspection proving real-time inference with `gemma-4-26b-a4b-it`.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 16 (App Router)
- **AI Model**: Google Gemma 4 (`gemma-4-26b-a4b-it`) via `@google/genai`
- **Model License**: [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- **Computer Vision / OCR**: `tesseract.js`
- **Styling**: Tailwind CSS v4 + PostCSS
- **Icons**: Lucide React
- **Language**: TypeScript

---

## 📦 How to Run Locally

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/scam-shield.git
cd scam-shield
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey):
```env
GEMINI_API_KEY=your_actual_gemini_api_key
```

### 4. Run the Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 5. Run the 10-Case Benchmark Test Suite
```bash
npm run test:scams
```
Verifies 100% accuracy across 10 real-world Pakistani fraud and legitimate messages.

---

## 🔮 What's Next (Roadmap)
1. **WhatsApp & SMS Bot**: Bring Scam Shield to WhatsApp for elderly parents who do not browse web apps.
2. **Community Scam Registry**: Crowdsourced reporting database to catalog new scam phone numbers and Pakistani bank accounts.
3. **Regional Voice Explanations**: Audio alerts in Punjabi, Pashto, and Sindhi for non-reading citizens.
4. **Browser Extension**: Real-time URL threat blocking during online shopping in Pakistan.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).  
Google Gemma 4 is developed by Google and licensed under [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).
