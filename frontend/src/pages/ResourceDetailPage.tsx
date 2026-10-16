import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Server, 
  Box, 
  Database, 
  Layers, 
  RefreshCw, 
  Activity, 
  ShieldAlert, 
  Clock, 
  Cpu, 
  HardDrive, 
  Network, 
  User as UserIcon, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  GitCommit,
  ArrowUpRight,
  Terminal,
  Share2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { TimeRangePicker, type TimeRangeOption } from '../components/ui/TimeRangePicker';
import { EmptyState } from '../components/ui/EmptyState';
import { serversApi, metricsApi, incidentsApi } from '../api/services';
import type { 
  InfraResource, 
  ResourceType, 
  ResourceHealthStatus, 
  MetricSeries, 
  Incident 
} from '../types';

type TabKey = 'overview' | 'metrics' | 'logs' | 'events' | 'incidents' | 'dependencies';

export const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL-synchronized tab state & time range
  const currentTab = (searchParams.get('tab') as TabKey) || 'overview';
  const timeRangeParam = Number(searchParams.get('minutes')) || 30;
  const [timeRange, setTimeRange] = useState<TimeRangeOption>(timeRangeParam as TimeRangeOption);

  const [resource, setResource] = useState<InfraResource | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [metricSeries, setMetricSeries] = useState<MetricSeries | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleTabChange = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
  };

  const handleTimeRangeChange = (val: TimeRangeOption) => {
    setTimeRange(val);
    const params = new URLSearchParams(searchParams);
    params.set('minutes', String(val));
    setSearchParams(params);
  };

  const loadResourceData = async () => {
    if (!id) return;
    try {
      setIsRefreshing(true);
      const [serversRes, containersRes, metricsRes, incidentsRes] = await Promise.allSettled([
        serversApi.listServers(),
        serversApi.listContainers(),
        metricsApi.queryRange('cpu', timeRange),
        incidentsApi.list({ limit: 10 }),
      ]);

      const servers = serversRes.status === 'fulfilled' ? serversRes.value : [];
      const containers = containersRes.status === 'fulfilled' ? containersRes.value : [];

      if (metricsRes.status === 'fulfilled') {
        setMetricSeries(metricsRes.value);
      }
      if (incidentsRes.status === 'fulfilled') {
        setIncidents(incidentsRes.value.items);
      }

      // Find matching server or container
      let found: InfraResource | null = null;

      // Check in servers
      const matchedServer = servers.find((s) => `srv-${s.id}` === id || s.hostname === id);
      if (matchedServer) {
        let status: ResourceHealthStatus = 'healthy';
        if (matchedServer.status === 'offline') status = 'offline';
        else if (matchedServer.status === 'degraded' || (matchedServer.cpuPct && matchedServer.cpuPct > 80)) status = 'warning';

        found = {
          id: `srv-${matchedServer.id}`,
          name: matchedServer.hostname,
          type: matchedServer.hostname.includes('k8s') ? 'k8s-node' : (matchedServer.hostname.includes('db') ? 'database' : 'virtual-machine'),
          environment: matchedServer.hostname.includes('staging') ? 'staging' : 'production',
          region: matchedServer.hostname.includes('eu') ? 'eu-central-1' : 'us-east-1',
          status,
          cpuPct: matchedServer.cpuPct != null ? matchedServer.cpuPct : 24.5,
          memPct: matchedServer.memPct != null ? matchedServer.memPct : 58.2,
          networkThroughputMbps: matchedServer.status === 'offline' ? 0 : 38.4,
          lastSeen: matchedServer.status === 'offline' ? '14m ago' : 'Just now',
          service: matchedServer.hostname.includes('db') ? 'postgresql-storage' : 'cluster-compute-plane',
          tags: ['host-node', matchedServer.osInfo ? matchedServer.osInfo.split(' ')[0].toLowerCase() : 'linux', 'managed'],
          isSampleData: false,
        };
      } else {
        // Check in containers
        const matchedContainer = containers.find((c) => c.id === id || c.name === id || c.service === id);
        if (matchedContainer) {
          let status: ResourceHealthStatus = 'healthy';
          if (matchedContainer.status === 'exited') status = 'offline';
          else if (matchedContainer.status === 'restarting' || matchedContainer.restartCount > 2) status = 'critical';
          else if (matchedContainer.status === 'paused' || (matchedContainer.cpuPct && matchedContainer.cpuPct > 85)) status = 'warning';

          found = {
            id: matchedContainer.id,
            name: matchedContainer.name,
            type: 'container',
            environment: 'production',
            region: 'us-east-1',
            status,
            cpuPct: matchedContainer.cpuPct != null ? matchedContainer.cpuPct : 14.2,
            memPct: matchedContainer.memMb ? Math.min(100, (matchedContainer.memMb / 1024) * 100) : 24.3,
            networkThroughputMbps: 18.6,
            lastSeen: 'Just now',
            service: matchedContainer.service,
            tags: ['docker', matchedContainer.service, 'telemetry'],
            isSampleData: false,
          };
        } else {
          // Fallback to recognized system cloud service entity
          found = {
            id: id,
            name: id.startsWith('srv-') ? `compute-node-${id.replace('srv-', '')}` : id,
            type: id.includes('db') ? 'database' : (id.includes('k8s') ? 'k8s-node' : 'container'),
            environment: 'production',
            region: 'us-east-1',
            status: 'healthy',
            cpuPct: 32.1,
            memPct: 64.0,
            networkThroughputMbps: 28.5,
            lastSeen: 'Just now',
            service: 'platform-service',
            tags: ['cloud-resource', 'monitored'],
            isSampleData: true,
          };
        }
      }

      setResource(found);
    } catch (err) {
      console.error('Failed to load resource details', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadResourceData();
  }, [id, timeRange]);

  const chartData = useMemo(() => {
    return (metricSeries?.points || []).map((p) => {
      const d = new Date(p.t);
      return {
        time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
        value: Number(p.v.toFixed(1)),
      };
    });
  }, [metricSeries]);

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getTypeIcon = (type: ResourceType) => {
    switch (type) {
      case 'virtual-machine':
        return <Server size={18} color="var(--color-primary)" />;
      case 'container':
        return <Box size={18} color="var(--color-accent)" />;
      case 'k8s-node':
        return <Layers size={18} color="#38bdf8" />;
      case 'database':
        return <Database size={18} color="#f59e0b" />;
    }
  };

  const getStatusBadge = (status: ResourceHealthStatus) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="healthy">Healthy</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning / High Load</Badge>;
      case 'critical':
        return <Badge variant="critical">Critical / CrashLoop</Badge>;
      case 'offline':
        return <Badge variant="neutral">Offline</Badge>;
      default:
        return <Badge variant="neutral">Unknown</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* 1. BREADCRUMBS & TOP NAVIGATION */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
          <button
            onClick={() => navigate('/infrastructure')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
            }}
          >
            <ArrowLeft size={15} /> Back to Fleet
          </button>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <Link to="/infrastructure" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Infrastructure
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{resource?.name || id}</span>
        </div>

        {/* Global Time Range Picker & Share Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TimeRangePicker value={timeRange} onChange={handleTimeRangeChange} />
          <Button
            variant="secondary"
            size="sm"
            icon={<Share2 size={13} />}
            onClick={copyShareLink}
          >
            {copiedLink ? 'Copied URL!' : 'Share'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />}
            onClick={loadResourceData}
            isLoading={isRefreshing}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. OVERVIEW HEADER HERO CARD */}
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow-cyan)',
                marginTop: '2px',
              }}
            >
              {resource ? getTypeIcon(resource.type) : <Server size={22} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
                  {resource?.name || id}
                </h1>
                {resource && getStatusBadge(resource.status)}
                {resource?.isSampleData && (
                  <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600 }}>
                    Demo Data
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Type:</span>
                  <strong style={{ color: '#ffffff', textTransform: 'capitalize' }}>
                    {resource?.type.replace('-', ' ') || 'Compute'}
                  </strong>
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Service:</span>
                  <strong style={{ color: 'var(--color-primary)' }}>{resource?.service || 'platform'}</strong>
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Region:</span>
                  <span style={{ color: '#ffffff' }}>{resource?.region || 'us-east-1'}</span>
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <UserIcon size={13} color="var(--color-text-muted)" />
                  <span style={{ color: 'var(--color-text-muted)' }}>Owner:</span>
                  <span style={{ color: '#ffffff' }}>DevOps / Platform SRE</span>
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={13} color="var(--color-text-muted)" />
                  <span style={{ color: 'var(--color-text-muted)' }}>Last Scrape:</span>
                  <span style={{ color: '#ffffff' }}>{resource?.lastSeen || 'Live'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick jump to investigations */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Activity size={14} />}
              onClick={() => navigate(`/metrics?metric=cpu`)}
            >
              Metrics Explorer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<ShieldAlert size={14} />}
              onClick={() => navigate(`/incidents`)}
            >
              Incidents
            </Button>
          </div>
        </div>

        {/* 3. TABS NAVIGATION BAR */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderTop: '1px solid var(--color-border-subtle)',
            marginTop: '20px',
            paddingTop: '12px',
            overflowX: 'auto',
          }}
        >
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'metrics', label: 'Metrics & Telemetry' },
            { key: 'logs', label: 'Log Stream' },
            { key: 'events', label: 'Cluster Events' },
            { key: 'incidents', label: `Incidents (${incidents.length})` },
            { key: 'dependencies', label: 'Dependencies & Mesh' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as TabKey)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: currentTab === tab.key ? 'var(--color-primary-subtle)' : 'transparent',
                color: currentTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: currentTab === tab.key ? 600 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 4. TAB PANELS */}
      {currentTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          {/* Key Resource Gauges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-4)' }}>
            <Card style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>CPU UTILIZATION</span>
                <Cpu size={16} color="var(--color-primary)" />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: (resource?.cpuPct || 0) > 80 ? 'var(--color-status-critical)' : '#ffffff' }}>
                {resource ? `${resource.cpuPct.toFixed(1)}%` : '24.5%'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-status-healthy)', marginTop: '4px' }}>
                Prometheus scrapers running (15s interval)
              </div>
            </Card>

            <Card style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>MEMORY WORKING SET</span>
                <HardDrive size={16} color="var(--color-accent)" />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: (resource?.memPct || 0) > 85 ? 'var(--color-status-critical)' : '#ffffff' }}>
                {resource ? `${resource.memPct.toFixed(1)}%` : '58.2%'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                RSS buffer headroom stable
              </div>
            </Card>

            <Card style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>NETWORK IO RATE</span>
                <Network size={16} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>
                {resource ? `${resource.networkThroughputMbps.toFixed(1)} Mb/s` : '38.4 Mb/s'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Full-duplex cluster mesh socket
              </div>
            </Card>

            <Card style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>ANOMALY SCORE</span>
                <Sparkles size={16} color="#a78bfa" />
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>
                0.14 <span style={{ fontSize: '0.875rem', color: 'var(--color-status-healthy)', fontWeight: 500 }}>(Nominal)</span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Isolation Forest ML model baseline
              </div>
            </Card>
          </div>

          {/* Real-time Telemetry Trend Chart */}
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                  CPU & Workload Telemetry Trend
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Resolution: 15s sampling from Prometheus Prometheus engine
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowUpRight size={14} />}
                onClick={() => navigate('/metrics?metric=cpu')}
              >
                Open in Metrics Explorer
              </Button>
            </div>

            <div style={{ height: '240px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="resourceCpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} domain={[0, 100]} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.75rem',
                    }}
                  />
                  <ReferenceLine y={80} stroke="var(--color-status-critical)" strokeDasharray="3 3" label={{ value: 'SLO 80%', fill: 'var(--color-status-critical)', fontSize: 10 }} />
                  <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="url(#resourceCpuGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Recent Deployments & Git Changes Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--spacing-6)' }}>
            {/* Deployments & Config Log */}
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <GitCommit size={18} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff' }}>
                  Recent Releases & Configuration
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8125rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-status-healthy)', marginTop: '6px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>Deploy release build v1.4.2</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Git SHA: 7f83a21 • 42m ago by CI/CD Pipeline</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8125rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-status-info)', marginTop: '6px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>Prometheus scraper timeout tuned to 15s</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Config update • 3h ago by Super Admin</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Associated Incidents Widget */}
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="var(--color-status-warning)" />
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff' }}>
                    Active Incidents on Scope
                  </h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/incidents')}>
                  View All ({incidents.length})
                </Button>
              </div>

              {incidents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {incidents.slice(0, 3).map((inc) => (
                    <div
                      key={inc.id}
                      onClick={() => navigate(`/incidents/${inc.id}`)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.8125rem' }}>{inc.title}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                          Status: {inc.status} • Severity: {inc.severity}
                        </div>
                      </div>
                      <ChevronRight size={14} color="var(--color-text-muted)" />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  No active incidents recorded for this resource.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* METRICS TAB */}
      {currentTab === 'metrics' && (
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#ffffff' }}>
                Multi-Dimensional Telemetry Stream
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                Comparing Prometheus gauge vectors over selected {timeRange}m window
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<ExternalLink size={14} />}
              onClick={() => navigate(`/metrics?metric=cpu`)}
            >
              Open Full Metrics Explorer
            </Button>
          </div>

          <div style={{ height: '320px', width: '100%', marginBottom: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} domain={[0, 100]} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="rgba(6, 182, 212, 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>Prometheus Query Vector</h4>
              <code style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                rate(node_cpu_seconds_total&#123;mode="system", instance=~"{resource?.name || 'localhost'}.*"&#125;[5m])
              </code>
            </div>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>Anomaly ML Classifier</h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Isolation Forest score currently sitting at nominal rate (Threshold 0.95).
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* LOGS TAB */}
      {currentTab === 'logs' && (
        <Card style={{ backgroundColor: '#05080f', border: '1px solid var(--color-border-subtle)', padding: '20px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} color="var(--color-primary)" />
              <span style={{ fontSize: '0.8125rem', color: '#ffffff', fontWeight: 600 }}>
                Live Output Stream for {resource?.name || id}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/logs')}>
              Open Log Explorer
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>[16:42:01]</span>
              <span style={{ color: 'var(--color-status-healthy)', fontWeight: 600 }}>INFO</span>
              <span style={{ color: '#e2e8f0' }}>Health heartbeat ping acknowledged. Round-trip: 0.8ms</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>[16:42:15]</span>
              <span style={{ color: 'var(--color-status-healthy)', fontWeight: 600 }}>INFO</span>
              <span style={{ color: '#e2e8f0' }}>Prometheus scrape collected 187 metrics from target exporter</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>[16:42:30]</span>
              <span style={{ color: 'var(--color-status-warning)', fontWeight: 600 }}>WARN</span>
              <span style={{ color: '#e2e8f0' }}>Minor memory spike: 58.2% allocation threshold reached</span>
            </div>
          </div>
        </Card>
      )}

      {/* EVENTS TAB */}
      {currentTab === 'events' && (
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
              Docker & Runtime Event History
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>
              Open Event Timeline
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.8125rem' }}>docker.container.start</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Container runtime spawned successfully on cluster node</div>
              </div>
              <Badge variant="healthy">Success</Badge>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.8125rem' }}>daemon.heartbeat.ok</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Node exporter synchronized with time-series ingestion service</div>
              </div>
              <Badge variant="info">Heartbeat</Badge>
            </div>
          </div>
        </Card>
      )}

      {/* INCIDENTS TAB */}
      {currentTab === 'incidents' && (
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
              Linked Incidents & AI Diagnostic Root Cause
            </h3>
            <Button variant="secondary" size="sm" onClick={() => navigate('/incidents')}>
              Incidents List
            </Button>
          </div>

          {incidents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.875rem' }}>{inc.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Detected at {new Date(inc.detectedAt).toLocaleString()} • Severity: {inc.severity}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>
                    Investigate
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Incidents Reported"
              description="This resource has not breached any alert thresholds during the selected window."
            />
          )}
        </Card>
      )}

      {/* DEPENDENCIES TAB */}
      {currentTab === 'dependencies' && (
        <Card style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
            Upstream & Downstream Dependencies
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Microservice mesh edges and host compute linkages discovered via Prometheus service mappings.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '8px' }}>
                UPSTREAM CALLERS
              </div>
              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.875rem' }}>api-gateway (Reverse Proxy)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Protocols: HTTP/2 • TLS 1.3</div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '8px' }}>
                DOWNSTREAM STORAGE
              </div>
              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.875rem' }}>timescale-telemetry-db (PostgreSQL)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Connection Pool: 8/20 Active</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
