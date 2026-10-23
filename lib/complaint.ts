export interface ComplaintData {
  incidentId: string;
  timestamp: string;
  senderInfo: string;
  scamType: string;
  threatLevel: string;
  messageContent: string;
  evidencePoints: string[];
}

export function generateFiaComplaint(data: ComplaintData, lang: 'roman' | 'urdu' = 'roman'): string {
  if (lang === 'urdu') {
    return `بخدمت جناب انچارج، ایف آئی اے سائبر کرائم رپورٹنگ سیل (NR3C)
موضوع: سائبر فراڈ اور مالیاتی دھوکہ دہی کی شکایت

جنابِ عالی،
میں مندرجہ ذیل سائبر کرائم اور مالیاتی فراڈ کی کوشش کے خلاف فوری قانونی کارروائی کی درخواست کرتا ہوں:

1. وقوعہ ریفرنس نمبر: ${data.incidentId}
2. تاریخ و وقت: ${data.timestamp}
3. مشکوک فون نمبر / بھیجنے والا: ${data.senderInfo || 'نامعلوم'}
4. فراڈ کی قسم: ${data.scamType}
5. خطرے کا لیول: ${data.threatLevel}

موصولہ مشکوک پیغام:
"${data.messageContent}"

تکنیکی و فرانزک شواہد:
${data.evidencePoints.map((pt, i) => `${i + 1}. ${pt}`).join('\n')}

استدعا ہے کہ اس جعل سازی میں ملوث عناصر اور مشکوک فون نمبر/اکاؤنٹ کے خلاف پیکا ایکٹ (PECA Act) کے تحت قانونی کارروائی عمل میں لائی جائے۔

العارض:
سائبر شیلڈ پاکستان ڈیجیٹل فرانزک لاگ`;
  }

  return `TO: Federal Investigation Agency (FIA) - National Response Centre for Cyber Crime (NR3C)
SUBJECT: Formal Cyber Fraud & Financial Impersonation Complaint

Respected Officer,

I hereby lodge a formal cybercrime complaint regarding a fraudulent social engineering attempt intercepted in Pakistan.

--- INCIDENT PARTICULARS ---
Incident Reference ID: ${data.incidentId}
Timestamp: ${data.timestamp}
Suspect Number / Channel: ${data.senderInfo || 'Not Specified'}
Scam Classification: ${data.scamType}
Assessed Threat Level: ${data.threatLevel.toUpperCase()}

--- INTERCEPTED MESSAGE PAYLOAD ---
"${data.messageContent}"

--- FORENSIC EVIDENCE & AI AUDIT TRAIL ---
${data.evidencePoints.map((pt, i) => `[${i + 1}] ${pt}`).join('\n')}

--- REQUESTED RELIEF ---
1. Immediate blacklisting and tracing of the sender's CLI / SIM IMSI under PECA 2016.
2. Inter-agency notification to telecom operators and SBP/1Link to prevent unauthorized fund movements.

Generated via Scam Shield Pakistan Enterprise Incident Response Module
Model Verification: Google Gemma 4 (26B-A4B-IT)`;
}
