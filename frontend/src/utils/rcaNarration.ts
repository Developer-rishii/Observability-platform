import type { Incident, RcaAnalysis } from '../types';

const FEATURE_SPOKEN_MAP: Record<string, string> = {
  cpu_pct_mean_5m: 'average CPU usage',
  cpu_pct_std_5m: 'CPU fluctuation',
  latency_p95_mean_5m: 'average response time',
  latency_p95_std_5m: 'response time variability',
  error_rate_5m: 'error rate',
  request_rate_mean_5m: 'request rate',
  container_die_count_15m: 'container crashes',
  data_dir_growth_5m: 'disk growth',
  anomaly_score: 'anomaly score',
};

/**
 * Clean markdown symbols, asterisks, hashes, backticks, bullets, and URLs.
 */
export function cleanText(input: string): string {
  if (!input) return '';
  return input
    .replace(/https?:\/\/\S+/gi, '') // remove urls
    .replace(/[#*`_~>[\]()]/g, '') // strip markdown markers
    .replace(/^\s*[-•*]\s+/gm, '') // strip bullet points at start of line
    .replace(/\s+/g, ' ') // collapse whitespaces
    .trim();
}

/**
 * Map raw feature or metric names to conversational spoken phrases.
 */
export function getSpokenFeatureName(name: string): string {
  if (!name) return '';
  const key = name.trim().toLowerCase();
  if (FEATURE_SPOKEN_MAP[key]) {
    return FEATURE_SPOKEN_MAP[key];
  }
  return key.replace(/_/g, ' ');
}

/**
 * Builds a conversational 20-30s narration (60-90 words) as an array of spoken sentences.
 */
export function buildNarration(incident: Incident, analysis: RcaAnalysis): string[] {
  const sentences: string[] = [];

  // 1. What happened: Severity, Service, Detection mechanism
  const severity = incident.severity ? incident.severity.toLowerCase() : 'high';
  const service = incident.affectedService ? incident.affectedService.replace(/_/g, ' ') : 'the system';
  let detector = 'by a static threshold';
  if (incident.detectionSource === 'ml') {
    detector = 'by the machine-learning anomaly detector';
  } else if (incident.detectionSource === 'rule') {
    detector = 'by a rule guard';
  }

  sentences.push(`A ${severity} severity incident on ${service} was flagged ${detector}.`);

  // 2. Telemetry signals involved
  const signals = incident.affectedMetrics && incident.affectedMetrics.length > 0
    ? incident.affectedMetrics
    : (incident.metricName ? [incident.metricName] : []);

  if (signals.length > 0) {
    const spokenSignals = signals.slice(0, 3).map(getSpokenFeatureName);
    if (spokenSignals.length === 1) {
      sentences.push(`The primary abnormal signal was ${spokenSignals[0]}.`);
    } else if (spokenSignals.length === 2) {
      sentences.push(`The abnormal signals included ${spokenSignals[0]} and ${spokenSignals[1]}.`);
    } else {
      sentences.push(`Key abnormal signals included ${spokenSignals[0]}, ${spokenSignals[1]}, and ${spokenSignals[2]}.`);
    }
  }

  // 3. Likely root cause (from summary or probableCause, shortened to first 1-2 sentences)
  const rawCause = analysis.probableCause || analysis.summary || '';
  const cleanedCause = cleanText(rawCause);
  if (cleanedCause) {
    // Split on periods or question marks
    const causeSentences = cleanedCause
      .split(/(?<=[.?!])\s+/)
      .filter((s) => s.trim().length > 0)
      .slice(0, 2);

    let causeText = causeSentences.join(' ');
    if (causeText) {
      // Check if starts with acronym (DNS, CPU) or camel/pascal proper noun (PostgreSQL, Redis, MySQL)
      const isProperNoun = /^[A-Z]{2,}/.test(causeText) || /^[A-Z][a-z0-9]+[A-Z]/.test(causeText);
      if (!isProperNoun) {
        causeText = causeText.charAt(0).toLowerCase() + causeText.slice(1);
      }
      sentences.push(`Diagnostics indicate ${causeText.endsWith('.') ? causeText : `${causeText}.`}`);
    }
  }

  // 4. Confidence
  const conf = analysis.confidence ? analysis.confidence.toLowerCase() : 'medium';
  sentences.push(`The analysis has ${conf} confidence.`);

  // 5. Top 1-2 recommended actions
  const recommendations = analysis.possibleRemediation && analysis.possibleRemediation.length > 0
    ? analysis.possibleRemediation
    : analysis.recommendedInvestigation;

  if (recommendations && recommendations.length > 0) {
    const formatAction = (str: string): string => {
      const cleaned = cleanText(str).replace(/[.,;:!]+$/, '').trim();
      if (!cleaned) return '';
      // Check if starts with uppercase acronym (e.g., DNS, CPU, API, SQL) or 2+ consecutive caps
      if (/^[A-Z]{2,}/.test(cleaned)) {
        return cleaned;
      }
      return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    };

    const topRecs = recommendations
      .slice(0, 2)
      .map(formatAction)
      .filter((r) => r.length > 0);

    if (topRecs.length === 1) {
      sentences.push(`Recommended next step: ${topRecs[0]}.`);
    } else if (topRecs.length >= 2) {
      sentences.push(`Recommended next steps: first, ${topRecs[0]}, then ${topRecs[1]}.`);
    }
  }

  return sentences;
}
