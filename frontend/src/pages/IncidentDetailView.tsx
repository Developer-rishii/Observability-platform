import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Cpu, 
  Sparkles, 
  Info
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { Card } from '../components/ui/Card';
import { SeverityBadge, StatusBadge, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { incidentsApi } from '../api/services';
import type { IncidentDetail, IncidentStatus, RcaAnalysis } from '../types';

export const IncidentDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const incidentId = Number(id);

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<RcaAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadIncident = async () => {
    if (!incidentId) return;
    try {
      setLoading(true);
      const data = await incidentsApi.getById(incidentId);
      setIncident(data);
      if (data.analysis) {
        const raw = data.analysis as any;
        setAiAnalysis({
          summary: raw.summary || raw.incidentSummary || '',
          probableCause: raw.probableCause || raw.probableRootCause || '',
          confidence: raw.confidence || 'medium',
          supportingEvidence: raw.supportingEvidence || [],
          affectedComponents: raw.affectedComponents || [],
          impact: raw.impact || '',
          recommendedInvestigation: raw.recommendedInvestigation || [],
          possibleRemediation: raw.possibleRemediation || [],
          alternativeCauses: raw.alternativeCauses || [],
          nextSteps: raw.nextSteps || raw.recommendedInvestigation || [],
          analyzedAt: raw.analyzedAt,
        });
      }
    } catch (err) {
      console.error('Failed to load incident details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!incident) return;
    try {
      setStatusUpdating(true);
      const updated = await incidentsApi.updateStatus(incident.id, newStatus);
      setIncident({ ...incident, status: updated.status });
    } catch (err: any) {
      alert(`Status update failed: ${err.response?.data?.detail || 'Invalid transition'}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleTriggerAiRca = async () => {
    if (!incident) return;
    try {
      setAnalyzingAi(true);
      setAiError(null);
      const result = await incidentsApi.analyzeWithAi(incident.id);
      setAiAnalysis(result);
    } catch (err: any) {
      if (err.response?.status === 503) {
        setAiError('AI Diagnostics API unavailable: GEMINI_API_KEY is not configured on the backend.');
      } else {
        setAiError(err.response?.data?.detail || 'AI Root-Cause Analysis failed.');
      }
    } finally {
      setAnalyzingAi(false);
    }
  };

  if (loading || !incident) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-text-secondary)' }}>
        Loading incident telemetry context...
      </div>
    );
  }

  // Primary metric evidence for chart
  const primaryMetric = incident.metricEvidence?.[0];
  const chartPoints = (primaryMetric?.points || []).map((p) => {
    const d = new Date(p.t);
    return {
      time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      value: Number(p.v.toFixed(1)),
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* Back button and header */}
      <div>
        <Link
          to="/incidents"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-text-muted)',
            textDecoration: 'none',
            fontSize: '0.8125rem',
            marginBottom: 'var(--spacing-3)',
          }}
        >
          <ArrowLeft size={14} /> Back to Incidents
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Incident ID #{incident.id}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
              {incident.title}
            </h1>
          </div>

          {/* Workflow Status Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Workflow Transition:</span>
            {incident.status === 'open' && (
              <Button
                variant="secondary"
                size="sm"
                isLoading={statusUpdating}
                onClick={() => handleStatusChange('investigating')}
              >
                Mark Investigating
              </Button>
            )}
            {incident.status === 'investigating' && (
              <Button
                variant="primary"
                size="sm"
                isLoading={statusUpdating}
                onClick={() => handleStatusChange('resolved')}
              >
                Resolve Incident
              </Button>
            )}
            {incident.status === 'resolved' && (
              <Badge variant="healthy">Resolved</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Telemetry Evidence & Explainable AI RCA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--spacing-6)' }}>
        {/* Left Column: Metric Evidence & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {/* Anomaly Timeline Chart */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff' }}>
                  Telemetry Anomaly Signature
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Correlated window: {incident.metricName} breached threshold ({incident.threshold}%)
                </span>
              </div>
              <Badge variant="warning">{incident.metricValue.toFixed(1)}% Peak</Badge>
            </div>

            <div style={{ height: '240px', width: '100%' }}>
              {chartPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="time"
                      stroke="var(--color-text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border-subtle)' }}
                    />
                    <YAxis
                      stroke="var(--color-text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border-subtle)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: '#ffffff',
                        fontSize: '0.8125rem',
                      }}
                    />
                    <ReferenceLine
                      y={incident.threshold}
                      stroke="var(--color-status-critical)"
                      strokeDasharray="3 3"
                      label={{ value: 'Limit', fill: 'var(--color-status-critical)', fontSize: 10, position: 'right' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 2, fill: 'var(--color-primary)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  Telemetry snapshot stored for incident record
                </div>
              )}
            </div>
          </Card>

          {/* Telemetry Context Specs */}
          <Card>
            <h3 style={{ margin: '0 0 var(--spacing-4) 0', fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff' }}>
              Correlated Telemetry Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8125rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Affected Service</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{incident.affectedService || 'Infrastructure Host'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Breached Metric</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{incident.metricName}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Anomaly Score</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{incident.anomalyScore ? incident.anomalyScore.toFixed(3) : '0.920'} (Isolation Forest)</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Detected At</span>
                <span style={{ color: '#ffffff', fontWeight: 500 }}>{new Date(incident.detectedAt).toLocaleString()}</span>
              </div>
            </div>

            {incident.affectedMetrics?.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '6px' }}>
                  Multi-Metric Correlation Blast Radius
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {incident.affectedMetrics.map((m) => (
                    <Badge key={m} variant="violet">{m}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Explainable AI Root-Cause Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <Card glow="violet" style={{ border: '1px solid rgba(139, 92, 246, 0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-primary) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={18} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                    Explainable AI Diagnostics
                  </h3>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                    Powered by Google Gemini RAG
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/incidents/${incident.id}/rca`)}
              >
                Open AI Workspace
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles size={14} />}
                isLoading={analyzingAi}
                onClick={handleTriggerAiRca}
              >
                {aiAnalysis ? 'Re-run Analysis' : 'Run Diagnostics'}
              </Button>
            </div>

            {/* AI Error Fallback */}
            {aiError && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-warning-bg)',
                  border: '1px solid var(--color-status-warning-border)',
                  color: 'var(--color-status-warning)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.4,
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={15} /> AI Model Advisory
                </div>
                <div style={{ marginTop: '4px' }}>{aiError}</div>
              </div>
            )}

            {/* AI Analysis Result */}
            {aiAnalysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
                {/* Confidence Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Analysis Confidence:</span>
                  <Badge variant={aiAnalysis.confidence === 'high' ? 'healthy' : 'warning'}>
                    {aiAnalysis.confidence.toUpperCase()} CONFIDENCE
                  </Badge>
                </div>

                {/* Summary */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Incident Summary
                  </span>
                  <p style={{ margin: '4px 0 0 0', color: '#ffffff', lineHeight: 1.5 }}>
                    {aiAnalysis.summary}
                  </p>
                </div>

                {/* Probable Cause */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Probable Root Cause
                  </span>
                  <div
                    style={{
                      margin: '4px 0 0 0',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(139, 92, 246, 0.12)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      color: '#e2e8f0',
                      lineHeight: 1.5,
                    }}
                  >
                    {aiAnalysis.probableCause}
                  </div>
                </div>

                {/* Recommended Next Steps */}
                {aiAnalysis.nextSteps?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Recommended Action Items
                    </span>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      {aiAnalysis.nextSteps.map((step, idx) => (
                        <li key={idx} style={{ color: '#ffffff' }}>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '36px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  gap: '10px',
                }}
              >
                <Cpu size={32} color="var(--color-accent)" />
                <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: 600 }}>
                  No AI Analysis Generated Yet
                </div>
                <div style={{ fontSize: '0.75rem', maxWidth: '320px', lineHeight: 1.4 }}>
                  Click &quot;Run Diagnostics&quot; to synthesize correlated anomaly telemetry, blast radius, and remediation runbooks.
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
