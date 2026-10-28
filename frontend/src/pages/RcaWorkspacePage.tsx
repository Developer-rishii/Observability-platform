import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronRight,
  Server,
  Database,
  Activity,
  ShieldAlert,
  Info,
  ListChecks,
  Wrench,
  GitBranch,
  Loader2,
  BarChart3,
  FileText,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Square,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { SeverityBadge, StatusBadge, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { incidentsApi } from '../api/services';
import type { IncidentDetail, RcaAnalysis } from '../types';
import { useSpeech } from '../hooks/useSpeech';
import { buildNarration } from '../utils/rcaNarration';
import { IncidentChatTab } from '../components/IncidentChatTab';

// ─── Sub-components ──────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'block',
      fontSize: '0.6875rem',
      fontWeight: 700,
      color: 'var(--color-text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '10px',
    }}
  >
    {children}
  </span>
);

const ConfidenceMeter: React.FC<{ confidence: 'low' | 'medium' | 'high' }> = ({ confidence }) => {
  const levels: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const colors: Record<string, string> = {
    low: 'var(--color-status-warning)',
    medium: '#60a5fa',
    high: 'var(--color-status-healthy)',
  };
  const labels: Record<string, string> = {
    low: 'Low Confidence',
    medium: 'Medium Confidence',
    high: 'High Confidence',
  };
  const descriptions: Record<string, string> = {
    low: 'Limited telemetry data. Manual investigation required to confirm.',
    medium: 'Moderate evidence supports this hypothesis. Verify before acting.',
    high: 'Strong evidence from multiple correlated signals. High probability of being accurate.',
  };
  const level = levels[confidence] ?? 1;
  const color = colors[confidence] ?? colors.low;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          Analysis Confidence
        </span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color }}>{labels[confidence]}</span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '3px',
              backgroundColor: n <= level ? color : 'rgba(255,255,255,0.08)',
              transition: 'background-color 0.3s ease',
            }}
          />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        {descriptions[confidence]}
      </p>
    </div>
  );
};

const EvidenceCard: React.FC<{ text: string; index: number }> = ({ text, index }) => (
  <div
    style={{
      display: 'flex',
      gap: '12px',
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'rgba(34,197,94,0.06)',
      border: '1px solid rgba(34,197,94,0.2)',
    }}
  >
    <div
      style={{
        flexShrink: 0,
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        backgroundColor: 'rgba(34,197,94,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6875rem',
        fontWeight: 700,
        color: 'var(--color-status-healthy)',
        marginTop: '1px',
      }}
    >
      {index + 1}
    </div>
    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#e2e8f0', lineHeight: 1.6 }}>{text}</p>
  </div>
);

const StepItem: React.FC<{
  text: string;
  index: number;
  variant?: 'investigate' | 'remediate';
}> = ({ text, index, variant = 'investigate' }) => {
  const isRemediate = variant === 'remediate';
  return (
    <div
      style={{
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        padding: '10px 0',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          border: `2px solid ${isRemediate ? 'rgba(251,191,36,0.4)' : 'rgba(139,92,246,0.4)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: isRemediate ? '#fbbf24' : 'var(--color-primary)',
          backgroundColor: isRemediate ? 'rgba(251,191,36,0.08)' : 'rgba(139,92,246,0.08)',
        }}
      >
        {index + 1}
      </div>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#e2e8f0', lineHeight: 1.6, flex: 1 }}>
        {text}
      </p>
    </div>
  );
};

const AlternativeCard: React.FC<{ text: string; index: number }> = ({ text, index }) => (
  <div
    style={{
      display: 'flex',
      gap: '12px',
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'rgba(148,163,184,0.05)',
      border: '1px solid rgba(148,163,184,0.15)',
    }}
  >
    <div
      style={{
        flexShrink: 0,
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        backgroundColor: 'rgba(148,163,184,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6875rem',
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        marginTop: '1px',
      }}
    >
      {index + 1}
    </div>
    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
      {text}
    </p>
  </div>
);

// ─── Tab definition ───────────────────────────────────────────────────────────

type Tab = 'root-cause' | 'evidence' | 'investigation' | 'remediation' | 'alternatives' | 'ask-ai';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'root-cause', label: 'Root Cause', icon: <AlertTriangle size={14} /> },
  { id: 'evidence', label: 'Evidence', icon: <CheckCircle2 size={14} /> },
  { id: 'investigation', label: 'Investigation', icon: <ListChecks size={14} /> },
  { id: 'remediation', label: 'Remediation', icon: <Wrench size={14} /> },
  { id: 'alternatives', label: 'Alternatives', icon: <GitBranch size={14} /> },
  { id: 'ask-ai', label: 'Ask AI', icon: <MessageSquare size={14} /> },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── RCA Pipeline Stepper & Activity Log ──────────────────────────────────────

interface PipelineStep {
  id: number;
  label: string;
  detail: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 1, label: 'Loading incident context', detail: 'Verifying incident record, status, and active cooldown window' },
  { id: 2, label: 'Collecting metrics, logs and events', detail: 'Synthesizing correlated telemetry signals and anomaly window' },
  { id: 3, label: 'Retrieving related knowledge', detail: 'Searching vector database (Qdrant) for operational runbooks' },
  { id: 4, label: 'Consulting AI model', detail: 'Synthesizing diagnostic prompt and querying Google Gemini' },
  { id: 5, label: 'Compiling root-cause report', detail: 'Validating structured schema, evidence, and remediation advice' },
];

interface LogEntry {
  id: string;
  timeSec: number;
  text: string;
}

export const RcaWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const incidentId = Number(id);

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loadingIncident, setLoadingIncident] = useState(true);
  const [analysis, setAnalysis] = useState<RcaAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('root-cause');
  const [analysisHistory, setAnalysisHistory] = useState<{ ts: string; confidence: string }[]>([]);

  // Stepper & Live Activity Log state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [failedStepIndex, setFailedStepIndex] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [showLogDrawer, setShowLogDrawer] = useState<boolean>(false);

  // Narration / Audio Speech state
  const speech = useSpeech();
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [showVoiceSelect, setShowVoiceSelect] = useState<boolean>(false);

  const runIdRef = React.useRef<number>(0);
  const stepTimersRef = React.useRef<number[]>([]);
  const elapsedIntervalRef = React.useRef<number | null>(null);
  const logContainerRef = React.useRef<HTMLDivElement | null>(null);

  const clearAllTimers = useCallback(() => {
    stepTimersRef.current.forEach((t) => clearTimeout(t));
    stepTimersRef.current = [];
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
      runIdRef.current += 1;
    };
  }, [clearAllTimers]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const loadIncident = useCallback(async () => {
    if (!incidentId) return;
    try {
      setLoadingIncident(true);
      const data = await incidentsApi.getById(incidentId);
      setIncident(data);
      if (data.analysis) {
        const raw = data.analysis as any;
        setAnalysis({
          summary: raw.summary || raw.incidentSummary || '',
          probableCause: raw.probableCause || raw.probableRootCause || '',
          confidence: raw.confidence || 'medium',
          supportingEvidence: raw.supportingEvidence || raw.supporting_evidence || [],
          affectedComponents: raw.affectedComponents || raw.affected_components || [],
          impact: raw.impact || '',
          recommendedInvestigation: raw.recommendedInvestigation || raw.recommended_investigation || [],
          possibleRemediation: raw.possibleRemediation || raw.possible_remediation || [],
          alternativeCauses: raw.alternativeCauses || raw.alternative_causes || [],
          nextSteps: raw.nextSteps || raw.recommendedInvestigation || raw.recommended_investigation || [],
          analyzedAt: raw.analyzedAt || raw.createdAt || new Date().toISOString(),
        });
      }
    } catch {
      /* handled below */
    } finally {
      setLoadingIncident(false);
    }
  }, [incidentId]);

  useEffect(() => { loadIncident(); }, [loadIncident]);

  const appendLog = useCallback((timeSec: number, text: string) => {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, timeSec, text },
    ]);
  }, []);

  const handleRunAnalysis = async () => {
    if (!incident) return;
    speech.stop();
    clearAllTimers();

    const currentRunId = ++runIdRef.current;
    setAnalyzing(true);
    setAiError(null);
    setFailedStepIndex(null);
    setCompletedSteps([]);
    setCurrentStepIndex(0);
    setElapsedSec(0);

    const startTime = Date.now();
    const metricLabel = incident.metricName || 'telemetry';
    const serviceName = incident.affectedService || 'host-system';
    const correlatedList = incident.affectedMetrics && incident.affectedMetrics.length > 0
      ? incident.affectedMetrics.join(', ')
      : metricLabel;

    const initialLogs: LogEntry[] = [
      { id: '1', timeSec: 0, text: `Initiating AI diagnostic pipeline for incident #${incident.id}` },
      { id: '2', timeSec: 0, text: `Target service: ${serviceName} | Detection source: ${incident.detectionSource || 'rule'}` },
      { id: '3', timeSec: 0, text: `Loading incident metadata and checking analysis cooldown` },
    ];
    setLogs(initialLogs);

    // Start elapsed-time timer
    elapsedIntervalRef.current = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    // Schedule progressive steps (1.5s, 4s, 5s)
    const t1 = window.setTimeout(() => {
      if (runIdRef.current !== currentRunId) return;
      setCompletedSteps([0]);
      setCurrentStepIndex(1);
      const s = Math.floor((Date.now() - startTime) / 1000);
      appendLog(s, `Incident context verified. Gathering telemetry signals`);
      appendLog(s, `Correlated signals: ${correlatedList}`);
    }, 1500);
    stepTimersRef.current.push(t1);

    const t2 = window.setTimeout(() => {
      if (runIdRef.current !== currentRunId) return;
      setCompletedSteps([0, 1]);
      setCurrentStepIndex(2);
      const s = Math.floor((Date.now() - startTime) / 1000);
      appendLog(s, `Metric window compiled. Querying Qdrant for related runbooks`);
    }, 5500);
    stepTimersRef.current.push(t2);

    const t3 = window.setTimeout(() => {
      if (runIdRef.current !== currentRunId) return;
      setCompletedSteps([0, 1, 2]);
      setCurrentStepIndex(3);
      const s = Math.floor((Date.now() - startTime) / 1000);
      appendLog(s, `Consulting Gemini AI model with synthesized telemetry context`);
      appendLog(s, `Awaiting model response (reasoning and root cause formulation)...`);
    }, 10500);
    stepTimersRef.current.push(t3);

    try {
      const result = await incidentsApi.analyzeWithAi(incident.id);
      if (runIdRef.current !== currentRunId) return;

      clearAllTimers();
      const s = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSec(s);

      // Fast-forward remaining steps (about 150ms per step)
      const currentIdx = currentStepIndex;
      appendLog(s, `AI model response received. Compiling final root-cause report`);

      if (result.confidence) {
        appendLog(s, `Report validated: ${result.confidence.toUpperCase()} confidence`);
      }
      if (result.supportingEvidence && result.supportingEvidence.length > 0) {
        appendLog(s, `Compiled ${result.supportingEvidence.length} evidence point(s) and remediation plan`);
      }

      for (let i = currentIdx; i < PIPELINE_STEPS.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (runIdRef.current !== currentRunId) return;
        setCurrentStepIndex(i);
        setCompletedSteps((prev) => Array.from(new Set([...prev, i])));
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      if (runIdRef.current !== currentRunId) return;

      setAnalysis(result);
      setAnalyzing(false);
      setAnalysisHistory((prev) => [
        { ts: result.analyzedAt ?? new Date().toISOString(), confidence: result.confidence },
        ...prev,
      ]);
    } catch (err: any) {
      if (runIdRef.current !== currentRunId) return;
      clearAllTimers();
      const s = Math.floor((Date.now() - startTime) / 1000);

      if (err.response?.status === 429) {
        const detail = err.response?.data?.detail || 'Analysis was run recently.';
        const retryAfter = err.response?.headers?.['retry-after'];
        const message = retryAfter
          ? `Analysis was run recently. Cooldown active: please retry in ${retryAfter}s.`
          : detail;
        setAiError(message);
        appendLog(s, `[429] ${message}`);
        setFailedStepIndex(0);
      } else if (err.response?.status === 503) {
        const detail = err.response?.data?.detail || 'AI service unavailable: LLM service could not be reached.';
        setAiError(detail);
        appendLog(s, `[503] ${detail}`);
        setFailedStepIndex(currentStepIndex >= 3 ? currentStepIndex : 3);
      } else {
        const detail = err.response?.data?.detail || 'AI Root-Cause Analysis failed. Please retry.';
        setAiError(detail);
        appendLog(s, `[ERROR] ${detail}`);
        setFailedStepIndex(currentStepIndex);
      }
      setAnalyzing(false);
    }
  };

  const durationSince = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const confidenceColor = (c: string) => {
    if (c === 'high') return 'var(--color-status-healthy)';
    if (c === 'medium') return '#60a5fa';
    return 'var(--color-status-warning)';
  };

  const componentIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('db') || n.includes('database') || n.includes('postgres') || n.includes('mongo'))
      return <Database size={13} />;
    if (n.includes('api') || n.includes('service') || n.includes('server'))
      return <Server size={13} />;
    return <Activity size={13} />;
  };

  const investigationSteps =
    (analysis?.recommendedInvestigation?.length ?? 0) > 0
      ? (analysis?.recommendedInvestigation ?? [])
      : (analysis?.nextSteps ?? []);

  if (loadingIncident) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', color: 'var(--color-text-secondary)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        Loading incident context…
      </div>
    );
  }

  if (!incident) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-text-muted)' }}>
        Incident not found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)', paddingBottom: 'var(--spacing-10)' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        <Link to="/incidents" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={13} /> Incidents
        </Link>
        <ChevronRight size={13} />
        <Link to={`/incidents/${incident.id}`} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          #{incident.id}
        </Link>
        <ChevronRight size={13} />
        <span style={{ color: 'var(--color-text-secondary)' }}>AI Root-Cause Analysis</span>
      </div>

      {/* Incident context header */}
      <div
        style={{
          padding: 'var(--spacing-5)',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(14,16,27,0.6) 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                INC-{incident.id}
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
              {incident.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {incident.affectedService && (
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Server size={13} /> {incident.affectedService}
                </span>
              )}
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} /> Detected {durationSince(incident.detectedAt)}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <BarChart3 size={13} />{' '}
                {incident.metricName === 'anomaly_score' || incident.detectionSource === 'ml' ? (
                  <>
                    {incident.metricName}: {incident.metricValue.toFixed(4)} (threshold {incident.threshold.toFixed(4)})
                  </>
                ) : (
                  <>
                    {incident.metricName}: {incident.metricValue.toFixed(1)}% (threshold {incident.threshold}%)
                  </>
                )}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <Button
              variant="primary"
              size="sm"
              icon={analyzing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              isLoading={analyzing}
              disabled={analyzing}
              onClick={handleRunAnalysis}
            >
              {analysis ? 'Re-run Analysis' : 'Run AI Analysis'}
            </Button>
            {analysis?.analyzedAt && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} /> Analyzed {durationSince(analysis.analyzedAt)}
              </span>
            )}
          </div>
        </div>
        {incident.affectedMetrics?.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
              Correlated signals:
            </span>
            {incident.affectedMetrics.map((m) => (
              <Badge key={m} variant="violet">{m}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* AI Error banner (shown only if stepper card is not mounted, e.g. when reviewing results) */}
      {aiError && !analyzing && failedStepIndex === null && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: '0.875rem', marginBottom: '4px' }}>
              AI Analysis Notice
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {aiError}
            </div>
          </div>
        </div>
      )}

      {/* Two-column body: sidebar + main panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--spacing-5)', alignItems: 'start' }}>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>

          {/* Analysis status */}
          <Card style={{ padding: 'var(--spacing-4)' }}>
            <SectionLabel>Analysis Status</SectionLabel>
            {analyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                    borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-subtle)',
                    border: '1px solid var(--color-border-focused)',
                  }}
                >
                  <Loader2 size={16} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                    In progress
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {PIPELINE_STEPS[currentStepIndex]?.label}
                </div>
              </div>
            ) : failedStepIndex !== null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                    borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                >
                  <AlertTriangle size={16} color="var(--color-status-critical)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-status-critical)' }}>
                    Analysis Failed
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  Stopped at: {PIPELINE_STEPS[failedStepIndex]?.label}
                </div>
              </div>
            ) : analysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                    borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                >
                  <CheckCircle2 size={16} color="var(--color-status-healthy)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-status-healthy)' }}>
                    Analysis Complete
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  Powered by Google Gemini. Results are advisory only.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                  borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(148,163,184,0.06)',
                  border: '1px solid rgba(148,163,184,0.15)',
                }}
              >
                <Info size={16} color="var(--color-text-muted)" />
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  No analysis yet
                </span>
              </div>
            )}
          </Card>

          {/* Confidence meter */}
          {analysis && (
            <Card style={{ padding: 'var(--spacing-4)' }}>
              <SectionLabel>Confidence Score</SectionLabel>
              <ConfidenceMeter confidence={analysis.confidence as 'low' | 'medium' | 'high'} />
            </Card>
          )}

          {/* Affected components */}
          {analysis && (analysis.affectedComponents?.length ?? 0) > 0 && (
            <Card style={{ padding: 'var(--spacing-4)' }}>
              <SectionLabel>Affected Components</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysis.affectedComponents.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(139,92,246,0.07)',
                      border: '1px solid rgba(139,92,246,0.15)',
                      fontSize: '0.8125rem', color: '#e2e8f0',
                    }}
                  >
                    <span style={{ color: 'var(--color-primary)' }}>{componentIcon(c)}</span>
                    {c}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Analysis history */}
          {analysisHistory.length > 0 && (
            <Card style={{ padding: 'var(--spacing-4)' }}>
              <SectionLabel>Analysis History</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysisHistory.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      backgroundColor: i === 0 ? 'rgba(139,92,246,0.07)' : 'transparent',
                      border: i === 0 ? '1px solid rgba(139,92,246,0.15)' : '1px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {durationSince(h.ts)}
                    </span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: confidenceColor(h.confidence), textTransform: 'uppercase' }}>
                      {h.confidence}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleRunAnalysis}
                disabled={analyzing}
                style={{
                  marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                  width: '100%', justifyContent: 'center', padding: '8px',
                  borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border-subtle)',
                  backgroundColor: 'transparent', color: 'var(--color-text-muted)',
                  fontSize: '0.8125rem', cursor: analyzing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <RefreshCw size={13} /> Refresh Analysis
              </button>
            </Card>
          )}

          {/* Quick links */}
          <Card style={{ padding: 'var(--spacing-4)' }}>
            <SectionLabel>Quick Links</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { to: `/incidents/${incident.id}`, label: 'Incident Timeline', icon: <Clock size={13} /> },
                { to: `/metrics`, label: 'Metrics Explorer', icon: <BarChart3 size={13} /> },
                { to: `/logs`, label: 'Log Explorer', icon: <FileText size={13} /> },
              ].map(({ to, label, icon }) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                    borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)',
                    textDecoration: 'none', fontSize: '0.8125rem', transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                >
                  {icon} {label} <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Main panel ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>

          {/* Empty state: No analysis yet and not analyzing and not in error */}
          {!analysis && !analyzing && failedStepIndex === null && (
            <Card glow="violet" style={{ border: '1px solid rgba(139,92,246,0.2)', padding: '48px 32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '64px', height: '64px', borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(79,70,229,0.2) 100%)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Sparkles size={30} color="var(--color-primary)" />
                </div>
                <div>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                    AI Investigation Ready
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: '480px' }}>
                    Run the AI analysis to synthesize correlated telemetry signals, identify the probable root cause,
                    and generate structured investigation and remediation guidance for incident{' '}
                    <strong style={{ color: 'var(--color-text-secondary)' }}>INC-{incident.id}</strong>.
                  </p>
                </div>
                <div
                  style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                    fontSize: '0.8125rem', color: '#fbbf24', maxWidth: '480px', lineHeight: 1.5,
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                  }}
                >
                  <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>
                    AI recommendations are advisory only. Do not execute any remediation without
                    explicit human authorization and an auditable change process.
                  </span>
                </div>
                <Button variant="primary" icon={<Sparkles size={14} />} onClick={handleRunAnalysis}>
                  Run AI Root-Cause Analysis
                </Button>
              </div>
            </Card>
          )}

          {/* Stepped Progress Indicator & Live Activity Log (Active run OR Failed state) */}
          {(analyzing || failedStepIndex !== null) && (
            <Card
              glow={failedStepIndex !== null ? 'none' : 'cyan'}
              style={{
                padding: '28px 24px',
                border: failedStepIndex !== null ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--color-border-focused)',
              }}
            >
              {/* Stepper Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: '#ffffff' }}>
                      {failedStepIndex !== null ? 'AI Analysis Interrupted' : 'Synthesizing Root Cause Diagnostics'}
                    </h3>
                    <Badge variant={failedStepIndex !== null ? 'critical' : 'info'}>
                      {failedStepIndex !== null ? 'Halted' : 'Active'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {failedStepIndex !== null
                      ? 'The diagnostic pipeline stopped due to an error or cooldown window.'
                      : 'Executing pipeline stages with live telemetry correlation.'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Elapsed Time</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                      {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
                    </div>
                  </div>
                  {failedStepIndex !== null && (
                    <Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={handleRunAnalysis}>
                      Retry Analysis
                    </Button>
                  )}
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  <span>Pipeline Progress</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {failedStepIndex !== null
                      ? Math.min(95, Math.max(15, (failedStepIndex + 1) * 20))
                      : Math.min(95, Math.max(10, completedSteps.length * 18 + Math.min(25, elapsedSec * 1.5)))}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${
                        failedStepIndex !== null
                          ? Math.min(95, Math.max(15, (failedStepIndex + 1) * 20))
                          : Math.min(95, Math.max(10, completedSteps.length * 18 + Math.min(25, elapsedSec * 1.5)))
                      }%`,
                      backgroundColor: failedStepIndex !== null ? 'var(--color-status-critical)' : 'var(--color-primary)',
                      boxShadow: failedStepIndex !== null ? 'none' : '0 0 10px var(--color-primary-glow)',
                      transition: 'width 0.4s ease-out, background-color 0.3s ease',
                    }}
                  />
                </div>
                {analyzing && elapsedSec >= 30 && (
                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={12} /> Model reasoning is taking longer than usual... Still working on incident #{incident.id}.
                  </div>
                )}
              </div>

              {/* Vertical Stepper */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginBottom: '24px',
                }}
                aria-live="polite"
              >
                {PIPELINE_STEPS.map((step, idx) => {
                  const isDone = completedSteps.includes(idx);
                  const isFailed = failedStepIndex === idx;
                  const isActive = !isDone && !isFailed && currentStepIndex === idx && analyzing;

                  let borderColor = 'var(--color-border-subtle)';
                  let iconBg = 'rgba(255,255,255,0.04)';
                  let iconColor = 'var(--color-text-muted)';
                  let titleColor = 'var(--color-text-muted)';

                  if (isDone) {
                    borderColor = 'rgba(34,197,94,0.3)';
                    iconBg = 'rgba(34,197,94,0.12)';
                    iconColor = 'var(--color-status-healthy)';
                    titleColor = '#ffffff';
                  } else if (isFailed) {
                    borderColor = 'rgba(239,68,68,0.4)';
                    iconBg = 'rgba(239,68,68,0.15)';
                    iconColor = 'var(--color-status-critical)';
                    titleColor = '#ffffff';
                  } else if (isActive) {
                    borderColor = 'var(--color-border-focused)';
                    iconBg = 'var(--color-primary-subtle)';
                    iconColor = 'var(--color-primary)';
                    titleColor = '#ffffff';
                  }

                  return (
                    <div
                      key={step.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isActive ? 'rgba(6,182,212,0.04)' : isFailed ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${borderColor}`,
                        transition: 'all 0.25s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Step Icon / Number Indicator */}
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: iconBg,
                            border: `1px solid ${iconColor}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: iconColor,
                          }}
                        >
                          {isDone ? (
                            <CheckCircle2 size={16} />
                          ) : isFailed ? (
                            <AlertTriangle size={15} />
                          ) : isActive ? (
                            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{step.id}</span>
                          )}
                        </div>

                        {/* Step Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: titleColor }}>
                              {step.label}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: isDone ? 'var(--color-status-healthy)' : isFailed ? 'var(--color-status-critical)' : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                              {isDone ? 'Completed' : isFailed ? 'Failed' : isActive ? 'Executing...' : 'Pending'}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {step.detail}
                          </div>
                        </div>
                      </div>

                      {/* Active step micro progress bar */}
                      {isActive && (
                        <div style={{ marginTop: '10px', height: '2px', width: '100%', backgroundColor: 'rgba(6,182,212,0.15)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: '40%',
                              backgroundColor: 'var(--color-primary)',
                              boxShadow: '0 0 8px var(--color-primary)',
                              animation: 'pulse 1.5s ease-in-out infinite',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Error Message banner if failed */}
              {aiError && failedStepIndex !== null && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '20px',
                  }}
                >
                  <AlertTriangle size={18} color="var(--color-status-critical)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-status-critical)', marginBottom: '2px' }}>
                      Diagnostic Run Halted
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#fca5a5', lineHeight: 1.5 }}>
                      {aiError}
                    </div>
                  </div>
                </div>
              )}

              {/* Live Activity Log Panel */}
              <div
                style={{
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#050811',
                  border: '1px solid var(--color-border-subtle)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Live Activity Log
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                    stdout / rca-pipeline
                  </span>
                </div>
                <div
                  ref={logContainerRef}
                  style={{
                    padding: '12px 14px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                    color: '#94a3b8',
                  }}
                >
                  {logs.map((log) => {
                    const min = String(Math.floor(log.timeSec / 60)).padStart(2, '0');
                    const sec = String(log.timeSec % 60).padStart(2, '0');
                    const isErr = log.text.includes('[ERROR]') || log.text.includes('[429]') || log.text.includes('[503]');
                    return (
                      <div key={log.id} style={{ display: 'flex', gap: '8px', color: isErr ? '#fca5a5' : '#cbd5e1' }}>
                        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>[{min}:{sec}]</span>
                        <span style={{ wordBreak: 'break-word' }}>{log.text}</span>
                      </div>
                    );
                  })}
                  {analyzing && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--color-primary)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        [{String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}]
                      </span>
                      <span>_</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Analysis results */}
          {analysis && !analyzing && (
            <>
              {/* Completed run activity log toggle */}
              {logs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-8px' }}>
                  <button
                    onClick={() => setShowLogDrawer((prev) => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    <FileText size={12} /> {showLogDrawer ? 'Hide diagnostic log' : 'View diagnostic log'}
                  </button>
                </div>
              )}

              {/* Collapsed/Expanded Log in result view */}
              {showLogDrawer && logs.length > 0 && (
                <div
                  style={{
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#050811',
                    border: '1px solid var(--color-border-subtle)',
                    padding: '12px 14px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                    color: '#94a3b8',
                  }}
                >
                  {logs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', gap: '8px', color: '#cbd5e1' }}>
                      <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        [{String(Math.floor(log.timeSec / 60)).padStart(2, '0')}:{String(log.timeSec % 60).padStart(2, '0')}]
                      </span>
                      <span style={{ wordBreak: 'break-word' }}>{log.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Spoken Explanation Narration Bar */}
              {speech.supported && (() => {
                const narrationSentences = buildNarration(incident, analysis);
                const isPlaying = speech.state === 'speaking';
                const isPaused = speech.state === 'paused';
                const isActive = isPlaying || isPaused;

                return (
                  <Card
                    glow={isActive ? 'cyan' : 'none'}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-lg)',
                      border: isActive ? '1px solid var(--color-border-focused)' : '1px solid var(--color-border-subtle)',
                      backgroundColor: 'rgba(6,182,212,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Play / Pause / Resume Button */}
                        {!isActive ? (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Volume2 size={15} />}
                            onClick={() => speech.speak(narrationSentences)}
                            aria-label="Listen to spoken audio explanation"
                          >
                            Listen
                          </Button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isPlaying ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Pause size={14} />}
                                onClick={speech.pause}
                                aria-label="Pause spoken explanation"
                              >
                                Pause
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Play size={14} />}
                                onClick={speech.resume}
                                aria-label="Resume spoken explanation"
                              >
                                Resume
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Square size={13} />}
                              onClick={speech.stop}
                              aria-label="Stop spoken explanation"
                            >
                              Stop
                            </Button>
                          </div>
                        )}

                        {/* Title & Animated Equalizer Waveform */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff' }}>
                            Audio Briefing
                          </span>
                          {isPlaying && (
                            <div
                              style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}
                              aria-hidden="true"
                            >
                              <style>
                                {`
                                  @keyframes waveBar1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
                                  @keyframes waveBar2 { 0%, 100% { height: 12px; } 50% { height: 5px; } }
                                  @keyframes waveBar3 { 0%, 100% { height: 6px; } 50% { height: 13px; } }
                                  @keyframes waveBar4 { 0%, 100% { height: 10px; } 50% { height: 4px; } }
                                  @media (prefers-reduced-motion: reduce) {
                                    .equalizer-bar { animation: none !important; height: 8px !important; }
                                  }
                                `}
                              </style>
                              <div className="equalizer-bar" style={{ width: '3px', backgroundColor: 'var(--color-primary)', borderRadius: '1px', animation: 'waveBar1 0.7s ease-in-out infinite' }} />
                              <div className="equalizer-bar" style={{ width: '3px', backgroundColor: 'var(--color-primary)', borderRadius: '1px', animation: 'waveBar2 0.85s ease-in-out infinite' }} />
                              <div className="equalizer-bar" style={{ width: '3px', backgroundColor: 'var(--color-primary)', borderRadius: '1px', animation: 'waveBar3 0.6s ease-in-out infinite' }} />
                              <div className="equalizer-bar" style={{ width: '3px', backgroundColor: 'var(--color-primary)', borderRadius: '1px', animation: 'waveBar4 0.75s ease-in-out infinite' }} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Voice selector & Transcript toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Voice selector dropdown toggle */}
                        {speech.voices.length > 0 && (
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setShowVoiceSelect((prev) => !prev)}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--color-border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 8px',
                                color: 'var(--color-text-secondary)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              aria-label="Select voice"
                            >
                              <span>{speech.selectedVoice ? speech.selectedVoice.name.slice(0, 16) + '...' : 'Select Voice'}</span>
                              <ChevronDown size={12} />
                            </button>

                            {showVoiceSelect && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: '4px',
                                  zIndex: 50,
                                  backgroundColor: 'var(--color-bg-surface)',
                                  border: '1px solid var(--color-border-default)',
                                  borderRadius: 'var(--radius-md)',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                  padding: '4px',
                                  maxHeight: '180px',
                                  overflowY: 'auto',
                                  width: '240px',
                                }}
                              >
                                {speech.voices.map((v) => (
                                  <div
                                    key={`${v.name}-${v.lang}`}
                                    onClick={() => {
                                      speech.setSelectedVoice(v);
                                      setShowVoiceSelect(false);
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      fontSize: '0.75rem',
                                      color: speech.selectedVoice?.name === v.name ? 'var(--color-primary)' : '#e2e8f0',
                                      backgroundColor: speech.selectedVoice?.name === v.name ? 'rgba(6,182,212,0.1)' : 'transparent',
                                      cursor: 'pointer',
                                      borderRadius: 'var(--radius-sm)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {v.name} ({v.lang})
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Transcript toggle */}
                        <button
                          onClick={() => setShowTranscript((prev) => !prev)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 6px',
                          }}
                        >
                          <FileText size={12} />
                          {showTranscript ? 'Hide transcript' : 'Show transcript'}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Transcript with sentence highlighting */}
                    {showTranscript && (
                      <div
                        style={{
                          backgroundColor: '#050811',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-subtle)',
                          padding: '12px 14px',
                          fontSize: '0.8125rem',
                          lineHeight: 1.6,
                        }}
                      >
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          Narration Transcript
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {narrationSentences.map((sentence, idx) => {
                            const isCurrent = speech.currentSentenceIndex === idx && isActive;
                            return (
                              <span
                                key={idx}
                                style={{
                                  color: isCurrent ? 'var(--color-primary)' : '#cbd5e1',
                                  fontWeight: isCurrent ? 600 : 400,
                                  backgroundColor: isCurrent ? 'rgba(6,182,212,0.08)' : 'transparent',
                                  padding: isCurrent ? '2px 6px' : '0',
                                  borderRadius: 'var(--radius-sm)',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                {sentence}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })()}

              {/* Tab bar */}
              <div
                style={{
                  display: 'flex', gap: '4px', padding: '4px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--color-border-subtle)', flexWrap: 'wrap',
                }}
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      border: 'none', cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: activeTab === tab.id ? 600 : 400,
                      backgroundColor: activeTab === tab.id ? 'rgba(139,92,246,0.2)' : 'transparent',
                      color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Root Cause */}
              {activeTab === 'root-cause' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                  <Card>
                    <SectionLabel>Incident Summary</SectionLabel>
                    <p style={{ margin: 0, fontSize: '0.9375rem', color: '#f1f5f9', lineHeight: 1.7 }}>
                      {analysis.summary}
                    </p>
                  </Card>
                  <Card glow="violet" style={{ border: '1px solid rgba(139,92,246,0.35)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <div
                        style={{
                          width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-primary) 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <AlertTriangle size={16} color="#ffffff" />
                      </div>
                      <div>
                        <SectionLabel>Probable Root Cause</SectionLabel>
                        <span
                          style={{
                            display: 'inline-block', marginTop: '-4px',
                            fontSize: '0.6875rem', fontWeight: 700,
                            color: confidenceColor(analysis.confidence),
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}
                        >
                          {analysis.confidence} confidence
                        </span>
                      </div>
                    </div>
                    <p
                      style={{
                        margin: 0, padding: '14px 16px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                        fontSize: '0.9375rem', color: '#e2e8f0', lineHeight: 1.7,
                      }}
                    >
                      {analysis.probableCause}
                    </p>
                  </Card>
                  {analysis.impact && (
                    <Card>
                      <SectionLabel>Estimated Impact</SectionLabel>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                        {analysis.impact}
                      </p>
                    </Card>
                  )}
                </div>
              )}

              {/* Evidence */}
              {activeTab === 'evidence' && (
                <Card>
                  <SectionLabel>Supporting Evidence</SectionLabel>
                  {(analysis.supportingEvidence?.length ?? 0) > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {analysis.supportingEvidence.map((e, i) => (
                        <EvidenceCard key={i} text={e.text} index={i} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                      No structured evidence items returned. Consider re-running the analysis.
                    </div>
                  )}
                </Card>
              )}

              {/* Investigation */}
              {activeTab === 'investigation' && (
                <Card>
                  <SectionLabel>Recommended Investigation Steps</SectionLabel>
                  {investigationSteps.length > 0 ? (
                    <div>
                      {investigationSteps.map((step, i) => (
                        <StepItem key={i} text={step} index={i} variant="investigate" />
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                      No investigation steps returned. Re-run the analysis to generate them.
                    </div>
                  )}
                </Card>
              )}

              {/* Remediation */}
              {activeTab === 'remediation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                  <div
                    style={{
                      display: 'flex', gap: '12px', padding: '14px 16px', borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                    }}
                  >
                    <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: '0.8125rem', marginBottom: '4px' }}>
                        Advisory Only — Human Approval Required
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        These suggestions are AI-generated. Do not execute any action without explicit authorization
                        from an incident commander and a logged, auditable change process.
                        No automated execution will occur from this interface.
                      </div>
                    </div>
                  </div>
                  <Card>
                    <SectionLabel>Possible Remediation Actions</SectionLabel>
                    {(analysis.possibleRemediation?.length ?? 0) > 0 ? (
                      <div>
                        {analysis.possibleRemediation.map((step, i) => (
                          <StepItem key={i} text={step} index={i} variant="remediate" />
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                        No remediation suggestions returned. Re-run the analysis to generate them.
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Alternatives */}
              {activeTab === 'alternatives' && (
                <Card>
                  <SectionLabel>Alternative Hypotheses</SectionLabel>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    The following alternative causes were identified but are considered less likely
                    given the available telemetry. Investigate these if the primary hypothesis is ruled out.
                  </p>
                  {(analysis.alternativeCauses?.length ?? 0) > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {analysis.alternativeCauses.map((alt, i) => (
                        <AlternativeCard key={i} text={alt} index={i} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                      No alternative hypotheses returned. Re-run the analysis.
                    </div>
                  )}
                </Card>
              )}

              {/* Ask AI Tab */}
              {activeTab === 'ask-ai' && (
                <IncidentChatTab
                  incident={incident}
                  hasStoredAnalysis={Boolean(analysis)}
                  onRunAnalysis={handleRunAnalysis}
                  speech={speech}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
