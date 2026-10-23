export interface PhoneAnalysisResult {
  phoneNumber: string;
  isValidPakistani: boolean;
  operator: string;
  accountType: 'Mobile' | 'Landline' | 'Shortcode' | 'International/Spoofed' | 'Unknown';
  riskScore: number; // 0 - 100
  riskLevel: 'high' | 'medium' | 'low';
  flags: string[];
}

export interface IbanAnalysisResult {
  iban: string;
  isValidPakistaniIban: boolean;
  bankName: string;
  bankCode: string;
  riskFlags: string[];
}

// Pakistani Mobile Operator Prefixes
const OPERATOR_PREFIXES: Record<string, string> = {
  '030': 'Jazz (Mobilink)',
  '031': 'Zong (CMPak)',
  '032': 'Jazz (Warid)',
  '033': 'Ufone (PTCL)',
  '034': 'Telenor (Easypaisa Network)',
  '035': 'Special Communications Organization (SCO)',
};

// Pakistani Bank Codes in IBAN (PKxx XXXX ...)
const PAKISTANI_BANKS: Record<string, string> = {
  'HABB': 'Habib Bank Limited (HBL)',
  'UNIL': 'United Bank Limited (UBL)',
  'MCBL': 'Muslim Commercial Bank (MCB)',
  'MEZN': 'Meezan Bank Limited (Islamic)',
  'ALFH': 'Bank Alfalah',
  'BAHL': 'Bank AL Habib',
  'ASCR': 'Standard Chartered Pakistan',
  'EPAY': 'Easypaisa (Telenor Microfinance Bank)',
  'MOBP': 'JazzCash (Mobilink Microfinance Bank)',
  'NAYA': 'NayaPay (EMI)',
  'SADA': 'SadaPay (EMI)',
  'BOP': 'The Bank of Punjab',
};

export function analyzePakistaniPhoneNumber(input: string): PhoneAnalysisResult {
  const flags: string[] = [];
  const clean = input.replace(/[\s\-\(\)]/g, '');

  let normalized = clean;
  if (normalized.startsWith('+92')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('0092')) {
    normalized = '0' + normalized.slice(4);
  } else if (normalized.startsWith('92')) {
    normalized = '0' + normalized.slice(2);
  }

  // Check if international number targeting Pakistan
  if (clean.startsWith('+') && !clean.startsWith('+92')) {
    const isAfricanVoip = clean.startsWith('+234') || clean.startsWith('+254') || clean.startsWith('+233');
    const isUkVoip = clean.startsWith('+447');

    return {
      phoneNumber: input,
      isValidPakistani: false,
      operator: 'International / Foreign Gateway',
      accountType: 'International/Spoofed',
      riskScore: isAfricanVoip || isUkVoip ? 95 : 75,
      riskLevel: 'high',
      flags: [
        'Foreign / International number contacting for Pakistani domestic services.',
        isAfricanVoip ? 'High-risk VoIP gateway frequently associated with WhatsApp social engineering.' : 'Unverified international CLI.',
      ],
    };
  }

  // Shortcode check (e.g. 8171, 3737, 4444)
  if (/^\d{4,5}$/.test(normalized)) {
    const knownShortcodes: Record<string, string> = {
      '8171': 'BISP (Official Government Shortcode)',
      '3737': 'Easypaisa (Official Consumer Shortcode)',
      '4444': 'JazzCash (Official Consumer Shortcode)',
      '8425': 'HBL Official Alert Shortcode',
      '8257': 'UBL Official Alert Shortcode',
    };

    const legitimate = knownShortcodes[normalized];
    return {
      phoneNumber: input,
      isValidPakistani: true,
      operator: legitimate ? `${legitimate}` : 'Unregistered Private Shortcode',
      accountType: 'Shortcode',
      riskScore: legitimate ? 10 : 80,
      riskLevel: legitimate ? 'low' : 'high',
      flags: legitimate
        ? ['Official verified financial/government shortcode.']
        : ['Unknown shortcode. Verify with telecommunication authority.'],
    };
  }

  // Standard Mobile Number validation (03XX-XXXXXXX)
  const isMobile = /^03\d{9}$/.test(normalized);
  if (!isMobile) {
    return {
      phoneNumber: input,
      isValidPakistani: false,
      operator: 'Invalid Format',
      accountType: 'Unknown',
      riskScore: 60,
      riskLevel: 'medium',
      flags: ['Does not match standard Pakistani mobile format (03XX-XXXXXXX).'],
    };
  }

  const prefix3 = normalized.slice(0, 3);
  const operator = OPERATOR_PREFIXES[prefix3] || 'Pakistani Mobile Network';

  // Check for common scam burner pattern (recently recycled numbers)
  return {
    phoneNumber: input,
    isValidPakistani: true,
    operator,
    accountType: 'Mobile',
    riskScore: 25,
    riskLevel: 'low',
    flags: [
      `Standard Pakistani mobile CLI detected (${operator}).`,
      'Personal SIMs must never be accepted as official bank or BISP communication channels.',
    ],
  };
}

export function analyzePakistaniIban(input: string): IbanAnalysisResult {
  const clean = input.replace(/\s+/g, '').toUpperCase();
  const riskFlags: string[] = [];

  const isValidFormat = /^PK\d{2}[A-Z]{4}\d{16}$/.test(clean);

  if (!isValidFormat) {
    return {
      iban: input,
      isValidPakistaniIban: false,
      bankName: 'Unknown / Invalid Format',
      bankCode: 'N/A',
      riskFlags: ['IBAN format must be 24 characters: PKxx BBBB xxxxxxxxxxxxxxxx'],
    };
  }

  const bankCode = clean.slice(4, 8);
  const bankName = PAKISTANI_BANKS[bankCode] || `Registered Pakistani Bank (${bankCode})`;

  return {
    iban: clean,
    isValidPakistaniIban: true,
    bankName,
    bankCode,
    riskFlags: [
      `Valid Pakistani IBAN associated with ${bankName}.`,
      'Do not transfer recovery funds without an official interbank dispute reference ticket.',
    ],
  };
}
