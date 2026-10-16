import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ChevronRight, 
  ArrowUpDown, 
  User as UserIcon, 
  ToggleLeft,
  ToggleRight,
  Flame,
  CheckCheck,
  Sparkles
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { SeverityBadge, StatusBadge, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { incidentsApi, alertsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { 
  Incident, 
  IncidentStatus, 
  Alert, 
  AlertRule 
} from '../types';

type WorkspaceTab = 'incidents' | 'alerts' | 'rules';

export const IncidentsList: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synchronized view states
  const activeTab = (searchParams.get('tab') as WorkspaceTab) || 'incidents';
  const statusFilter = searchParams.get('status') || 'all';
  const severityFilter = searchParams.get('severity') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const [search, setSearch] = useState(searchQuery);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pagination & Sorting
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [sortField, setSortField] = useState<'detectedAt' | 'severity' | 'metricValue'>('detectedAt');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Production Detection Alert Rules (Preconfigured policies)
  const [rules, setRules] = useState<AlertRule[]>([
    {
      id: 'rule-cpu-breach',
      name: 'High CPU Sustained Breach',
      metric: 'node_cpu_utilization_pct',
      condition: '>',
      threshold: 80.0,
      unit: '%',
      evaluationWindow: '3 consecutive scrapes (45s)',
      severity: 'critical',
      enabled: true,
      targetService: 'compute-fleet',
    },
    {
      id: 'rule-mem-breach',
      name: 'Host Memory Exhaustion Warning',
      metric: 'node_memory_utilization_pct',
      condition: '>',
      threshold: 85.0,
      unit: '%',
      evaluationWindow: '3 consecutive scrapes (45s)',
      severity: 'high',
      enabled: true,
      targetService: 'compute-fleet',
    },
    {
      id: 'rule-disk-pressure',
      name: 'Storage Volume Capacity Saturation',
      metric: 'node_disk_utilization_pct',
      condition: '>',
      threshold: 90.0,
      unit: '%',
      evaluationWindow: '5 consecutive scrapes (75s)',
      severity: 'high',
      enabled: true,
      targetService: 'timescale-telemetry-db',
    },
    {
      id: 'rule-anomaly-forest',
      name: 'Isolation Forest Multivariate Anomaly',
      metric: 'isolation_forest_score',
      condition: '>=',
      threshold: 0.95,
      unit: 'score',
      evaluationWindow: '15-minute rolling window',
      severity: 'critical',
      enabled: true,
      targetService: 'all-services',
    },
  ]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
    setPage(1);
  };

  const loadWorkspaceData = async () => {
    try {
      setIsRefreshing(true);
      setActionError(null);
      const [incidentsRes, alertsRes] = await Promise.allSettled([
        incidentsApi.list({ limit: 100 }),
        alertsApi.list({ limit: 100 }),
      ]);

      if (incidentsRes.status === 'fulfilled') {
        setIncidents(incidentsRes.value.items);
      }
      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value.items);
      }
    } catch (err) {
      console.error('Failed to load incident workspace telemetry', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('q', search.trim());
  };

  // KPI calculations
  const kpi = useMemo(() => {
    const openIncidents = incidents.filter((i) => i.status === 'open').length;
    const criticalIncidents = incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length;
    const firingAlerts = alerts.filter((a) => a.status === 'firing').length;
    const acknowledgedAlerts = alerts.filter((a) => a.status === 'acknowledged').length;
    const resolvedIncidents = incidents.filter((i) => i.status === 'resolved').length;
    return { openIncidents, criticalIncidents, firingAlerts, acknowledgedAlerts, resolvedIncidents };
  }, [incidents, alerts]);

  // Filtered & sorted incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = inc.title.toLowerCase().includes(q);
        const matchesMetric = inc.metricName.toLowerCase().includes(q);
        const matchesService = inc.affectedService?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMetric && !matchesService) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortField === 'detectedAt') {
        const timeA = new Date(a.detectedAt).getTime();
        const timeB = new Date(b.detectedAt).getTime();
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'metricValue') {
        return sortAsc ? a.metricValue - b.metricValue : b.metricValue - a.metricValue;
      }
      return 0;
    });
  }, [incidents, statusFilter, severityFilter, searchQuery, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredIncidents.length / pageSize) || 1;
  const paginatedIncidents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredIncidents.slice(start, start + pageSize);
  }, [filteredIncidents, page, pageSize]);

  // Transition Incident Status
  const handleTransitionStatus = async (incident: Incident, targetStatus: IncidentStatus) => {
    if (targetStatus === 'resolved' && !window.confirm(`Are you sure you want to resolve incident #${incident.id}: "${incident.title}"?`)) {
      return;
    }

    try {
      setActionInProgressId(incident.id);
      setActionError(null);
      const updated = await incidentsApi.updateStatus(incident.id, targetStatus);
      setIncidents((prev) => prev.map((item) => (item.id === incident.id ? updated : item)));
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update incident lifecycle status.';
      setActionError(`Incident #${incident.id}: ${msg}`);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Transition Alert Status
  const handleAcknowledgeAlert = async (alertItem: Alert) => {
    try {
      setActionInProgressId(alertItem.id);
      setActionError(null);
      const updated = await alertsApi.updateStatus(alertItem.id, 'acknowledged');
      setAlerts((prev) => prev.map((item) => (item.id === alertItem.id ? updated : item)));
    } catch (err: any) {
      setActionError(`Alert #${alertItem.id}: Failed to acknowledge signal.`);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleResolveAlert = async (alertItem: Alert) => {
    try {
      setActionInProgressId(alertItem.id);
      setActionError(null);
      const updated = await alertsApi.updateStatus(alertItem.id, 'resolved');
      setAlerts((prev) => prev.map((item) => (item.id === alertItem.id ? updated : item)));
    } catch (err: any) {
      setActionError(`Alert #${alertItem.id}: Failed to resolve alert.`);
    } finally {
      setActionInProgressId(null);
    }
  };

  const toggleRuleEnabled = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Incidents & Alert Command Center"
        description="Unified operational workspace for rule evaluation, anomaly signals, and incident remediation."
        badge={<Badge variant="violet">us-east-prod</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />}
              onClick={loadWorkspaceData}
              isLoading={isRefreshing}
            >
              Refresh Feed
            </Button>
          </div>
        }
      />

      {/* Action Error Banner */}
      {actionError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-critical-bg)',
            border: '1px solid var(--color-status-critical-border)',
            color: 'var(--color-status-critical)',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 600 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. KPI CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--spacing-4)',
        }}
      >
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>OPEN INCIDENTS</span>
            <ShieldAlert size={16} color="var(--color-status-warning)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{kpi.openIncidents}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Awaiting investigation or triage
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-status-critical)' }}>CRITICAL INCIDENTS</span>
            <XCircle size={16} color="var(--color-status-critical)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{kpi.criticalIncidents}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            SLO breach &gt; 20% limit
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>FIRING ALERTS</span>
            <Flame size={16} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{kpi.firingAlerts}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Active evaluation breaches
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a78bfa' }}>ACKNOWLEDGED</span>
            <CheckCheck size={16} color="#a78bfa" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{kpi.acknowledgedAlerts}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Owned by operations on-call
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-status-healthy)' }}>RESOLVED</span>
            <CheckCircle2 size={16} color="var(--color-status-healthy)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{kpi.resolvedIncidents}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Remediated in current cycle
          </div>
        </Card>
      </div>

      {/* 3. TABS SWITCHER & CONTROLS */}
      <Card style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Main workspace tabs */}
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--color-border-subtle)',
              padding: '2px',
            }}
          >
            <button
              onClick={() => updateParam('tab', 'incidents')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activeTab === 'incidents' ? 'var(--color-primary-subtle)' : 'transparent',
                color: activeTab === 'incidents' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tracked Incidents ({incidents.length})
            </button>
            <button
              onClick={() => updateParam('tab', 'alerts')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activeTab === 'alerts' ? 'var(--color-primary-subtle)' : 'transparent',
                color: activeTab === 'alerts' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Alert Signals ({alerts.length})
            </button>
            <button
              onClick={() => updateParam('tab', 'rules')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activeTab === 'rules' ? 'var(--color-primary-subtle)' : 'transparent',
                color: activeTab === 'rules' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Detection Rules ({rules.length})
            </button>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search by title, metric, service..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>

          {/* Filters (for Incidents tab) */}
          {activeTab === 'incidents' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={statusFilter}
                onChange={(e) => updateParam('status', e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="candidate">Candidate</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => updateParam('severity', e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {(statusFilter !== 'all' || severityFilter !== 'all' || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSearchParams(new URLSearchParams());
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 4. TAB CONTENT 1: INCIDENTS TABLE */}
      {activeTab === 'incidents' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>SEVERITY</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>INCIDENT TITLE</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>AFFECTED RESOURCE</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>TELEMETRY BREACH</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>STATUS</th>
                  <th
                    onClick={() => {
                      setSortField('detectedAt');
                      setSortAsc(!sortAsc);
                    }}
                    style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      DETECTED TIME <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>ASSIGNEE</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>WORKFLOW ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedIncidents.length > 0 ? (
                  paginatedIncidents.map((incident) => {
                    const detectedDate = new Date(incident.detectedAt);
                    const isBusy = actionInProgressId === incident.id;

                    return (
                      <tr
                        key={incident.id}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          transition: 'background-color var(--transition-fast)',
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <SeverityBadge severity={incident.severity} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Link
                            to={`/incidents/${incident.id}`}
                            style={{
                              color: '#ffffff',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {incident.title}
                          </Link>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                            ID: #{incident.id} • Root metric: {incident.metricName}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                            {incident.affectedService || 'host-infrastructure'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#ffffff' }}>
                          <span style={{ color: incident.metricValue > incident.threshold ? 'var(--color-status-critical)' : '#ffffff' }}>
                            {incident.metricValue.toFixed(1)}%
                          </span>{' '}
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>
                            (Limit {incident.threshold}%)
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge status={incident.status} />
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                          {detectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <div style={{ fontSize: '0.6875rem' }}>{detectedDate.toLocaleDateString()}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <UserIcon size={12} color="var(--color-text-muted)" />
                            <span>DevOps On-Call</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* Workflow state advance buttons */}
                            {incident.status === 'open' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleTransitionStatus(incident, 'investigating')}
                              >
                                Investigate
                              </Button>
                            )}

                            {incident.status === 'investigating' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleTransitionStatus(incident, 'resolved')}
                              >
                                Resolve
                              </Button>
                            )}

                            <Link to={`/incidents/${incident.id}`}>
                              <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>
                                Details
                              </Button>
                            </Link>
                            <Link to={`/incidents/${incident.id}/rca`}>
                              <Button variant="ghost" size="sm" icon={<Sparkles size={13} />}>
                                AI RCA
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center' }}>
                      <EmptyState
                        title="No Incidents Found"
                        description="All platform services are operating comfortably within established baseline thresholds."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <div>
              Showing {filteredIncidents.length === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, filteredIncidents.length)} of {filteredIncidents.length} incidents
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 5. TAB CONTENT 2: ALERTS SIGNALS TABLE */}
      {activeTab === 'alerts' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>ALERT RULE</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>TARGET METRIC</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>TRIGGER VALUE</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>TRIGGERED TIME</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600 }}>LINKED INCIDENT</th>
                  <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length > 0 ? (
                  alerts.map((alt) => {
                    const isBusy = actionInProgressId === alt.id;
                    return (
                      <tr key={alt.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge
                            variant={alt.status === 'firing' ? 'critical' : alt.status === 'acknowledged' ? 'warning' : 'healthy'}
                          >
                            {alt.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#ffffff' }}>
                          {alt.ruleName}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-primary)' }}>
                          {alt.metricName}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#ffffff' }}>
                          {alt.value != null ? `${alt.value.toFixed(1)}%` : 'Breach'}{' '}
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>
                            (&gt; {alt.threshold}%)
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                          {alt.triggeredAt ? new Date(alt.triggeredAt).toLocaleTimeString() : 'Recent'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {alt.incidentId ? (
                            <Link
                              to={`/incidents/${alt.incidentId}`}
                              style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}
                            >
                              Incident #{alt.incidentId}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>Standalone</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {alt.status === 'firing' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleAcknowledgeAlert(alt)}
                              >
                                Acknowledge
                              </Button>
                            )}
                            {alt.status !== 'resolved' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleResolveAlert(alt)}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center' }}>
                      <EmptyState
                        title="No Active Alerts"
                        description="All rule evaluation metrics are streaming below defined operational limits."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 6. TAB CONTENT 3: ALERT POLICIES & RULES */}
      {activeTab === 'rules' && (
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#ffffff' }}>
                  Operational Alert Policies & Threshold Rules
                </h3>
                <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600 }}>
                  Demo Data
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                Production detection rules evaluated on continuous 15s intervals via Prometheus time-series engines.
              </p>
            </div>
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => alert('Custom policy authoring is governed by Platform SRE approval.')}
              >
                Author New Rule
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#ffffff' }}>{rule.name}</span>
                    <SeverityBadge severity={rule.severity} />
                    <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: 'var(--color-text-muted)' }}>
                      {rule.targetService}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Condition: <strong style={{ color: 'var(--color-primary)' }}>{rule.metric} {rule.condition} {rule.threshold}{rule.unit}</strong> • Evaluated: {rule.evaluationWindow}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: rule.enabled ? 'var(--color-status-healthy)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                    {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => toggleRuleEnabled(rule.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: rule.enabled ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        padding: 0,
                      }}
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
