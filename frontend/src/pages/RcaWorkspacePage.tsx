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
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { SeverityBadge, StatusBadge, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { incidentsApi } from '../api/services';
import type { IncidentDetail, RcaAnalysis } from '../types';

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

type Tab = 'root-cause' | 'evidence' | 'investigation' | 'remediation' | 'alternatives';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'root-cause', label: 'Root Cause', icon: <AlertTriangle size={14} /> },
  { id: 'evidence', label: 'Evidence', icon: <CheckCircle2 size={14} /> },
  { id: 'investigation', label: 'Investigation', icon: <ListChecks size={14} /> },
  { id: 'remediation', label: 'Remediation', icon: <Wrench size={14} /> },
  { id: 'alternatives', label: 'Alternatives', icon: <GitBranch size={14} /> },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  const loadIncident = useCallback(async () => {
    if (!incidentId) return;
    try {
      setLoadingIncident(true);
      const data = await incidentsApi.getById(incidentId);
      setIncident(data);
      if (data.analysis) setAnalysis(data.analysis as RcaAnalysis);
    } catch {
      /* handled below */
    } finally {
      setLoadingIncident(false);
    }
  }, [incidentId]);

  useEffect(() => { loadIncident(); }, [loadIncident]);

  const handleRunAnalysis = async () => {
    if (!incident) return;
    try {
      setAnalyzing(true);
      setAiError(null);
      const result = await incidentsApi.analyzeWithAi(incident.id);
      setAnalysis(result);
      setAnalysisHistory((prev) => [
        { ts: result.analyzedAt ?? new Date().toISOString(), confidence: result.confidence },
        ...prev,
      ]);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setAiError(err.response?.data?.detail || 'Analysis cooldown active. Please wait a moment before requesting diagnostics again.');
      } else if (err.response?.status === 503) {
        setAiError(err.response?.data?.detail || 'AI service unavailable: LLM service could not be reached.');
      } else {
        setAiError(err.response?.data?.detail || 'AI Root-Cause Analysis failed. Please retry.');
      }
    } finally {
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
                <BarChart3 size={13} /> {incident.metricName}: {incident.metricValue.toFixed(1)}% (threshold {incident.threshold}%)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <Button
              variant="primary"
              size="sm"
              icon={analyzing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              isLoading={analyzing}
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

      {/* AI Error banner */}
      {aiError && (
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
              AI Analysis Unavailable
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {aiError}
            </div>
          </div>
        </div>
      )}

      {/* Two-column body: sidebar + main panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--spacing-5)', alignItems: 'start' }}>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>

          {/* Analysis status */}
          <Card style={{ padding: 'var(--spacing-4)' }}>
            <SectionLabel>Analysis Status</SectionLabel>
            {analysis ? (
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
                  Powered by Google Gemini. Results are AI-generated and advisory only.
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

          {/* Empty state */}
          {!analysis && !analyzing && (
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

          {/* Analyzing spinner */}
          {analyzing && (
            <Card style={{ padding: '48px 32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      border: '3px solid rgba(139,92,246,0.2)',
                      borderTopColor: 'var(--color-primary)',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <Sparkles
                    size={22}
                    color="var(--color-primary)"
                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>
                    Analyzing Incident…
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5, maxWidth: '360px' }}>
                    Synthesizing telemetry context and consulting the AI model.
                    This may take 10–30 seconds.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Analysis results */}
          {analysis && !analyzing && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
