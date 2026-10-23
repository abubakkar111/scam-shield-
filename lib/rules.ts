export interface RuleViolation {
  category: 'keyword' | 'url' | 'urgency' | 'brand_spoof';
  severity: 'high' | 'medium' | 'low';
  message: string;
  matched: string;
}

export interface RulesAnalysisResult {
  triggered: boolean;
  overallRisk: 'high' | 'medium' | 'low';
  violations: RuleViolation[];
}

// Suspicious Pakistani scam phrases (Roman Urdu, English, Urdu)
const SCAM_PHRASES: { phrase: string; severity: 'high' | 'medium'; category: RuleViolation['category']; label: string }[] = [
  // Accidental Money Transfer & Wallet Fraud
  { phrase: 'ghalti se paise', severity: 'high', category: 'keyword', label: 'Ghalti se paise bhejne ka bahana (Accidental Transfer Scam)' },
  { phrase: 'galti se paise', severity: 'high', category: 'keyword', label: 'Ghalti se paise bhejne ka bahana' },
  { phrase: 'ghalti se bhej', severity: 'high', category: 'keyword', label: 'Ghalti se raqam bhejne ka dawa' },
  { phrase: 'galti se bhej', severity: 'high', category: 'keyword', label: 'Ghalti se raqam bhejne ka dawa' },
  { phrase: 'paise wapis', severity: 'high', category: 'keyword', label: 'Paise wapis mangne ka dabao' },
  { phrase: 'paise wapas', severity: 'high', category: 'keyword', label: 'Paise wapas mangne ka dabao' },
  { phrase: 'wapis bhej do', severity: 'high', category: 'keyword', label: 'Paisa fori wapis mangne ki koshish' },
  { phrase: 'wapis bhej dein', severity: 'high', category: 'keyword', label: 'Paisa fori wapis mangne ki koshish' },
  { phrase: 'wapas bhej dein', severity: 'high', category: 'keyword', label: 'Paisa wapis mangne ki koshish' },
  { phrase: 'wapas bhej do', severity: 'high', category: 'keyword', label: 'Paisa wapis mangne ki koshish' },

  // OTP and Credential Stealing
  { phrase: 'otp share', severity: 'high', category: 'keyword', label: 'OTP mangne ki koshish (High Risk Security Violation)' },
  { phrase: 'otp batayein', severity: 'high', category: 'keyword', label: 'Secret OTP mangne ki koshish' },
  { phrase: 'pin code', severity: 'high', category: 'keyword', label: 'PIN code share karne ka mutalba' },
  { phrase: 'pin share', severity: 'high', category: 'keyword', label: 'Secret PIN mangna' },
  { phrase: 'password send', severity: 'high', category: 'keyword', label: 'Password churanay ki koshish' },

  // Account Suspension / Fear Tactics
  { phrase: 'account block', severity: 'high', category: 'urgency', label: 'Account band honay ka khauf (Account Block Fear Tactic)' },
  { phrase: 'account suspend', severity: 'high', category: 'urgency', label: 'Account muattal honay ka dar' },
  { phrase: 'sim block', severity: 'high', category: 'urgency', label: 'SIM block honay ki dhamki' },
  { phrase: 'biometric verify', severity: 'medium', category: 'urgency', label: 'Fake Biometric verification ka dabao' },

  // Fake Government / Welfare Grants (BISP, Ehsaas, NADRA)
  { phrase: 'bisp', severity: 'high', category: 'brand_spoof', label: 'Fake BISP Scheme ka zikr (Benazir Income Support Scam)' },
  { phrase: 'ehsaas', severity: 'high', category: 'brand_spoof', label: 'Fake Ehsaas Program Scheme' },
  { phrase: 'benazir income', severity: 'high', category: 'brand_spoof', label: 'BISP brand misuse' },
  { phrase: 'nadra verification', severity: 'medium', category: 'brand_spoof', label: 'Fake NADRA call/action' },

  // Fake Prizes, Lottery & Jobs
  { phrase: 'inam', severity: 'high', category: 'keyword', label: 'Inam / Lucky Draw ka lalach' },
  { phrase: 'jeet gaye', severity: 'high', category: 'keyword', label: 'Fake Lottery / Lucky draw jeetnay ka dawa' },
  { phrase: 'car jeet', severity: 'high', category: 'keyword', label: 'Jeeto Pakistan / Fake car prize' },
  { phrase: 'advance fee', severity: 'high', category: 'keyword', label: 'Advance fee mangna (Pre-payment fraud)' },
  { phrase: 'job from home', severity: 'medium', category: 'keyword', label: 'Ghar baithe kamai ka lalach (Task/Job Scam)' },
  { phrase: 'daily earning', severity: 'medium', category: 'keyword', label: 'Rozana munafa / Task fraud' },
  { phrase: 'abhi click karein', severity: 'medium', category: 'urgency', label: 'Fori click karne ka dabao (Urgency)' },
];

// Dangerous TLDs commonly used by scammers
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.live', '.buzz', '.work', '.link', '.surf', '.shop', '.icu', '.site'];

// Known URL Shorteners
const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 'is.gd', 'cutt.ly', 'rb.gy', 't.co', 'ow.ly', 'shorturl.at'];

// Genuine Pakistani financial / official domains
const LEGIT_DOMAINS = [
  'easypaisa.com.pk',
  'jazzcash.com.pk',
  'hbl.com',
  'ubldigital.com',
  'mcb.com.pk',
  'meezanbank.com',
  'nadra.gov.pk',
  'bisp.gov.pk',
];

export interface UrlInspectionResult {
  url: string;
  domain: string;
  isHttps: boolean;
  isShortener: boolean;
  isSuspiciousTld: boolean;
  spoofedBrand: string | null;
  hasHyphens: boolean;
  riskLevel: 'high' | 'medium' | 'low';
  verdict: string;
}

export function inspectUrlSafety(rawUrl: string): UrlInspectionResult | null {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/i;
  const match = rawUrl.match(urlRegex);
  if (!match) return null;

  const found = match[0];
  const isHttps = found.toLowerCase().startsWith('https://');
  const clean = found.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
  const domain = clean.split('/')[0].split('?')[0];

  const isShortener = URL_SHORTENERS.some(s => domain === s || domain.endsWith('.' + s));
  const isSuspiciousTld = SUSPICIOUS_TLDS.some(t => domain.endsWith(t));

  let spoofedBrand: string | null = null;
  const brands = ['easypaisa', 'jazzcash', 'hbl', 'ubl', 'bisp', 'nadra', 'fesco', 'nayapay', 'sadapay'];
  for (const b of brands) {
    if (domain.includes(b)) {
      const isLegit = LEGIT_DOMAINS.some(legit => domain === legit || domain.endsWith('.' + legit));
      if (!isLegit) {
        spoofedBrand = b;
        break;
      }
    }
  }

  const hasHyphens = (domain.match(/-/g) || []).length >= 2;

  let riskLevel: 'high' | 'medium' | 'low' = 'low';
  let verdict = 'Domain format appears standard, but verify origin before entering credentials.';

  if (spoofedBrand || isSuspiciousTld) {
    riskLevel = 'high';
    verdict = spoofedBrand
      ? `DO NOT CLICK: Impersonating ${spoofedBrand.toUpperCase()} via untrusted domain (${domain})`
      : `DANGEROUS TLD: Scam domain pattern detected (${domain})`;
  } else if (isShortener || hasHyphens || !isHttps) {
    riskLevel = 'medium';
    verdict = isShortener
      ? 'CAUTION: Shortened link masks the real destination website.'
      : !isHttps
      ? 'CAUTION: Insecure connection (HTTP without SSL).'
      : 'CAUTION: Unusually high hyphen count in domain.';
  }

  return {
    url: found,
    domain,
    isHttps,
    isShortener,
    isSuspiciousTld,
    spoofedBrand,
    hasHyphens,
    riskLevel,
    verdict,
  };
}

export function runSecurityRules(text: string): RulesAnalysisResult {
  const violations: RuleViolation[] = [];
  const lower = text.toLowerCase();

  // 1. Keyword & Phrase Checks
  for (const item of SCAM_PHRASES) {
    if (lower.includes(item.phrase)) {
      violations.push({
        category: item.category,
        severity: item.severity,
        message: item.label,
        matched: item.phrase,
      });
    }
  }

  // 2. URL & Link Analysis
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/gi;
  const foundUrls = text.match(urlRegex) || [];

  for (const rawUrl of foundUrls) {
    let cleanUrl = rawUrl.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
    const domain = cleanUrl.split('/')[0].split('?')[0];

    // Check for IP address URLs (e.g., http://192.168.1.1/easypaisa)
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}/;
    if (ipRegex.test(domain)) {
      violations.push({
        category: 'url',
        severity: 'high',
        message: 'IP Address link paya gaya (IP-based URLs are extremely dangerous)',
        matched: rawUrl,
      });
    }

    // Check for URL Shorteners
    for (const shortener of URL_SHORTENERS) {
      if (domain === shortener || domain.endsWith('.' + shortener)) {
        violations.push({
          category: 'url',
          severity: 'medium',
          message: `URL Shortener (${shortener}) asli website ko chupata hai`,
          matched: rawUrl,
        });
      }
    }

    // Check for Suspicious TLDs
    for (const tld of SUSPICIOUS_TLDS) {
      if (domain.endsWith(tld)) {
        violations.push({
          category: 'url',
          severity: 'high',
          message: `Mashkook sasta domain extension (${tld}) jo scams mein istemal hota hai`,
          matched: rawUrl,
        });
      }
    }

    // Check for Brand Spoofing (e.g. easypaisa-cash.com, jazzcash-claim.top)
    const brands = ['easypaisa', 'jazzcash', 'hbl', 'ubl', 'bisp', 'nadra', 'fesco', 'nayapay', 'sadapay'];
    for (const brand of brands) {
      if (domain.includes(brand)) {
        const isLegit = LEGIT_DOMAINS.some(legit => domain === legit || domain.endsWith('.' + legit));
        if (!isLegit) {
          violations.push({
            category: 'brand_spoof',
            severity: 'high',
            message: `Fake lookalike domain! (${brand} ka naam chura kar banaya gaya link)`,
            matched: rawUrl,
          });
        }
      }
    }

    // High hyphen count in domain name (common phishing pattern)
    const hyphenCount = (domain.match(/-/g) || []).length;
    if (hyphenCount >= 2) {
      violations.push({
        category: 'url',
        severity: 'medium',
        message: 'Domain name mein bohat ziyada hyphens hain (Fake domain trick)',
        matched: rawUrl,
      });
    }
  }

  // Calculate overall risk
  let overallRisk: 'high' | 'medium' | 'low' = 'low';
  const hasHigh = violations.some(v => v.severity === 'high');
  const hasMedium = violations.some(v => v.severity === 'medium');

  if (hasHigh) {
    overallRisk = 'high';
  } else if (hasMedium) {
    overallRisk = 'medium';
  }

  return {
    triggered: violations.length > 0,
    overallRisk,
    violations,
  };
}
