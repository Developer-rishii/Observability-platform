/**
 * Unit test suite for src/utils/rcaNarration.ts.
 * Runs directly against the REAL source file.
 */
import { buildNarration, cleanText, getSpokenFeatureName } from './rcaNarration.ts';
import type { Incident, RcaAnalysis } from '../types/index.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runNarrationTests() {
  console.log('Running rcaNarration tests...');

  // Test 1: Markdown, URL, and bullet stripping
  const dirty = '## Root cause: `database` pool **exhausted** at https://example.com/docs. - Bullet point;';
  const cleaned = cleanText(dirty);
  assert(!cleaned.includes('##'), 'Should strip hashes');
  assert(!cleaned.includes('**'), 'Should strip bold asterisks');
  assert(!cleaned.includes('`'), 'Should strip backticks');
  assert(!cleaned.includes('https://'), 'Should strip URLs');
  assert(!cleaned.startsWith('-'), 'Should strip bullet points');
  console.log('✓ Markdown, URL, and bullet stripping passed');

  // Test 2: Spoken feature name fallback and uppercase handling
  assert(getSpokenFeatureName('latency_p95_std_5m') === 'response time variability', 'Mapped feature name');
  assert(getSpokenFeatureName('LATENCY_P95_STD_5M') === 'response time variability', 'Case-insensitive mapped feature name');
  assert(getSpokenFeatureName('CUSTOM_UNMAPPED_SIGNAL') === 'custom unmapped signal', 'Uppercase unmapped fallback');
  assert(getSpokenFeatureName('custom_signal') === 'custom signal', 'Lowercase unmapped fallback');
  console.log('✓ Feature name mapping & uppercase handling passed');

  // Test 3: ML incident narration
  const mlIncident: Incident = {
    id: 339,
    title: 'High anomaly_score breach',
    severity: 'high',
    status: 'resolved',
    affectedService: 'demo-app',
    metricName: 'anomaly_score',
    metricValue: 0.7764,
    threshold: 0.7287,
    detectionSource: 'ml',
    detectedAt: new Date().toISOString(),
    affectedMetrics: ['LATENCY_P95_STD_5M', 'REQUEST_RATE_MEAN_5M'],
  };

  const sampleAnalysis: RcaAnalysis = {
    summary: 'Sudden spike in downstream latency caused connection queue saturation. Requests backed up across worker threads.',
    probableCause: 'PostgreSQL connection exhaustion under artificial delay.',
    confidence: 'high',
    supportingEvidence: [{ text: 'Latency p95 reached 18000ms' }],
    affectedComponents: ['demo-app', 'demo-db'],
    impact: 'Degraded throughput',
    recommendedInvestigation: ['Check active database connections', 'Inspect slow queries'],
    possibleRemediation: ['Scale database connection pool size.', 'Reset injected latency fault;'],
    alternativeCauses: ['Network partition'],
    nextSteps: ['Check logs'],
  };

  const sentences = buildNarration(mlIncident, sampleAnalysis);
  assert(sentences.length >= 4, 'Should build multiple sentences');
  assert(sentences[0].includes('machine-learning anomaly detector'), 'Should state ML detector');
  assert(sentences[1].includes('response time variability'), 'Should include spoken signals');
  assert(sentences[2].includes('PostgreSQL connection exhaustion'), 'Should include likely root cause');
  // Check revised confidence wording
  assert(sentences[3] === 'The analysis has high confidence.', 'Exact confidence sentence match');
  // Check revised action formatting: lowercase first letter, trailing punctuation stripped, joined as "first, ..., then ..."
  assert(sentences[4] === 'Recommended next steps: first, scale database connection pool size, then reset injected latency fault.', `Actions formatted correctly (got: "${sentences[4]}")`);
  assert(!sentences.some(s => s.includes('0.7764') || s.includes('0.7287')), 'Must not read out raw anomaly score decimals');

  const fullText = sentences.join(' ');
  const wordCount = fullText.split(/\s+/).length;
  assert(wordCount >= 40 && wordCount <= 90, `Word count should be under ~90 words (got ${wordCount})`);
  console.log(`✓ ML narration passed (${wordCount} words): "${fullText}"`);

  // Test 4: Rule incident narration
  const ruleIncident: Incident = {
    ...mlIncident,
    detectionSource: 'rule',
    metricName: 'error_rate_5m',
    affectedMetrics: [],
  };
  const ruleSentences = buildNarration(ruleIncident, sampleAnalysis);
  assert(ruleSentences[0].includes('by a rule guard'), 'Should state rule guard detector');
  console.log('✓ Rule detection wording passed');

  // Test 5: Threshold incident narration
  const thresholdIncident: Incident = {
    ...mlIncident,
    detectionSource: null,
    metricName: 'cpu_usage',
    affectedMetrics: [],
  };
  const thresholdSentences = buildNarration(thresholdIncident, sampleAnalysis);
  assert(thresholdSentences[0].includes('by a static threshold'), 'Should state static threshold detector');
  console.log('✓ Static threshold detection wording passed');

  // Test 6: Single action and acronym preservation
  const singleActionAnalysis: RcaAnalysis = {
    ...sampleAnalysis,
    possibleRemediation: ['DNS cache flush needed.'],
  };
  const singleActionSentences = buildNarration(mlIncident, singleActionAnalysis);
  assert(singleActionSentences[4] === 'Recommended next step: DNS cache flush needed.', `Should preserve uppercase acronym and single step wording (got: "${singleActionSentences[4]}")`);
  console.log('✓ Single action and acronym preservation passed');

  // Test 7: Missing fields handling
  const emptyAnalysis: RcaAnalysis = {
    summary: '',
    probableCause: '',
    confidence: 'low',
    supportingEvidence: [],
    affectedComponents: [],
    impact: '',
    recommendedInvestigation: [],
    possibleRemediation: [],
    alternativeCauses: [],
    nextSteps: [],
  };
  const sparseSentences = buildNarration({ ...mlIncident, affectedMetrics: [] }, emptyAnalysis);
  assert(sparseSentences.length > 0, 'Should build valid sentences even with missing analysis fields');
  assert(sparseSentences.some(s => s === 'The analysis has low confidence.'), 'Low confidence handled');
  console.log('✓ Missing fields handling passed');

  // Test 8: Real Incident #340 payload from PostgreSQL
  const realIncident340: Incident = {
    id: 340,
    title: 'High anomaly_score breach',
    severity: 'high',
    status: 'resolved',
    affectedService: 'demo-app',
    metricName: 'anomaly_score',
    metricValue: 0.7764,
    threshold: 0.7287,
    detectionSource: 'ml',
    detectedAt: '2026-10-27T16:45:25.606619',
    affectedMetrics: ['latency_p95_std_5m', 'request_rate_mean_5m', 'latency_p95_mean_5m'],
  };

  const realAnalysis340: RcaAnalysis = {
    summary: 'An ML anomaly score breach was detected in demo-app driven by concurrent spikes in request volume and 95th percentile latency variability.',
    probableCause: 'A sudden surge in incoming traffic overwhelmed demo-app compute capacity, leading to latency degradation and elevated variance across p95 latency metrics.',
    confidence: 'medium',
    supportingEvidence: [],
    affectedComponents: ['demo-app'],
    impact: 'End-users experienced elevated p95 latency and variable response times on demo-app during the traffic peak.',
    recommendedInvestigation: ['Analyze HTTP request logs around 2026-10-27T16:45:25'],
    possibleRemediation: [
      'Scale out demo-app pod replicas horizontally to accommodate higher incoming request rates.',
      'Enforce rate-limiting or request throttling rules at the ingress controller to protect demo-app from unmanaged traffic bursts.',
    ],
    alternativeCauses: [],
    nextSteps: [],
  };

  const realSentences = buildNarration(realIncident340, realAnalysis340);
  const realWordCount = realSentences.join(' ').split(/\s+/).length;
  assert(realSentences.length >= 4, 'Real incident narration built');
  assert(realWordCount <= 90, `Real incident narration should be under 90 words (got ${realWordCount})`);
  console.log(`✓ Real Incident #340 narration passed (${realWordCount} words):`);
  realSentences.forEach((s, idx) => console.log(`   [${idx + 1}] ${s}`));

  console.log('All rcaNarration tests passed successfully.');
}

runNarrationTests();
