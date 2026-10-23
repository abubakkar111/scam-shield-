import { GemmaAnalysisResult } from '@/app/api/check/route';
import { RulesAnalysisResult } from './rules';

export interface CombinedSecurityAssessment {
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
  threatScore: number; // 0 to 100 for enterprise radar
}

export function combineSecurityLayers(
  gemma: GemmaAnalysisResult,
  rules: RulesAnalysisResult,
  lang: 'roman' | 'urdu' = 'roman'
): CombinedSecurityAssessment {
  let finalRisk: 'high' | 'medium' | 'low' = 'low';
  let threatScore = 20;

  // 1. Evaluate Risk Matrix
  if (gemma.risk === 'high' || rules.overallRisk === 'high') {
    finalRisk = 'high';
    threatScore = 92;
  } else if (gemma.risk === 'medium' || rules.overallRisk === 'medium') {
    finalRisk = 'medium';
    threatScore = 65;
  } else {
    // If Gemma says low, but rules found any violation
    if (rules.triggered) {
      finalRisk = 'medium';
      threatScore = 55;
    } else {
      finalRisk = 'low';
      threatScore = 15;
    }
  }

  // 2. Prepare Clean, Human-Friendly Reasons
  // Use Gemma 4's contextual reasons as the primary natural language explanation
  let combinedReasons: string[] = Array.isArray(gemma.reasons) && gemma.reasons.length > 0
    ? [...gemma.reasons]
    : [];

  // If rules caught a high-severity violation (e.g., lookalike domain or shortener) that wasn't already explained,
  // add at most ONE concise rule summary note instead of dumping multiple duplicate flags
  if (rules.violations.length > 0) {
    const topViolation = rules.violations.find(v => v.severity === 'high') || rules.violations[0];
    if (topViolation) {
      const summaryRule = lang === 'urdu'
        ? `سیکیورٹی سسٹم الرٹ: ${topViolation.message}`
        : `Security Heuristics Alert: ${topViolation.message}`;
      
      // Only append if reasons list is short (< 4) and not already duplicated
      if (combinedReasons.length < 4 && !combinedReasons.some(r => r.includes(topViolation.message))) {
        combinedReasons.push(summaryRule);
      }
    }
  }

  // Fallback if empty
  if (combinedReasons.length === 0) {
    combinedReasons = [
      lang === 'urdu'
        ? 'اس پیغام کا تکنیکی اور لغوی جائزہ مکمل کیا گیا ہے۔'
        : 'Message context and safety indicators evaluated.',
    ];
  }

  // 3. Prepare Layer Highlights for Explainability
  const gemmaHighlights = gemma.reasons.slice(0, 3);
  const rulesHighlights = rules.violations.map(v => `${v.message} [${v.matched}]`);

  return {
    finalRisk,
    scamType: gemma.scam_type || (rules.violations[0]?.message ?? 'Suspicious Activity'),
    reasons: combinedReasons,
    nextSteps: gemma.next_steps,
    layerBreakdown: {
      gemmaVerdict: gemma.risk,
      gemmaHighlights,
      rulesVerdict: rules.overallRisk,
      rulesTriggered: rules.triggered,
      rulesHighlights,
    },
    threatScore,
  };
}
