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

  // 2. Aggregate reasons (Gemma reasons + Rules violations)
  const combinedReasons: string[] = [...gemma.reasons];

  for (const violation of rules.violations) {
    const formattedViolation = lang === 'urdu'
      ? `سیکیورٹی رولز فلیگ: ${violation.message} (${violation.matched})`
      : `Security Rule Flag: ${violation.message} ("${violation.matched}")`;
    if (!combinedReasons.includes(formattedViolation)) {
      combinedReasons.push(formattedViolation);
    }
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
