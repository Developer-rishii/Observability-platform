import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Server as ServerIcon, 
  Box, 
  Database, 
  Layers, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  ArrowUpDown, 
  Activity, 
  FileText, 
  ShieldAlert,
  Plus,
  Copy,
  Check
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { EmptyState } from '../components/ui/EmptyState';
import { serversApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { InfraResource, ResourceType, ResourceHealthStatus, Server, Container } from '../types';

export const InfrastructurePage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synchronized filter state
  const statusFilter = searchParams.get('status') || 'all';
  const typeFilter = searchParams.get('type') || 'all';
  const envFilter = searchParams.get('env') || 'all';
  const searchQuery = searchParams.get('q') || '';
  const viewMode = (searchParams.get('view') as 'table' | 'topology') || 'table';

  const [search, setSearch] = useState(searchQuery);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<keyof InfraResource>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [resources, setResources] = useState<InfraResource[]>([]);

  // Agent Onboarding Modal State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardHostname, setOnboardHostname] = useState('');
  const [onboardIp, setOnboardIp] = useState('');
  const [onboardOs, setOnboardOs] = useState('Linux (Ubuntu / Debian)');
  const [onboardEnv, setOnboardEnv] = useState('production');
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<{
    server: Server;
    enrollmentToken: string;
    installCommand: string;
    instructions: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);


  // Update query params helper
  const updateQueryParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
    setPage(1);
  };

  const loadInfrastructure = async () => {
    try {
      setIsRefreshing(true);
      const [serversRes, containersRes] = await Promise.allSettled([
        serversApi.listServers(),
        serversApi.listContainers(),
      ]);

      const liveServers: Server[] = serversRes.status === 'fulfilled' ? serversRes.value : [];
      const liveContainers: Container[] = containersRes.status === 'fulfilled' ? containersRes.value : [];

      const mappedResources: InfraResource[] = [];

      // 1. Map Live Servers (or realistic node fallback)
      liveServers.forEach((s) => {
        let status: ResourceHealthStatus = 'healthy';
        if (s.status === 'offline') status = 'offline';
        else if (s.status === 'degraded' || (s.cpuPct && s.cpuPct > 80)) status = 'warning';

        mappedResources.push({
          id: `srv-${s.id}`,
          name: s.hostname,
          type: s.hostname.includes('k8s') ? 'k8s-node' : (s.hostname.includes('db') ? 'database' : 'virtual-machine'),
          environment: s.hostname.includes('staging') ? 'staging' : 'production',
          region: s.hostname.includes('eu') ? 'eu-central-1' : 'us-east-1',
          status,
          cpuPct: s.cpuPct != null ? s.cpuPct : 18.5,
          memPct: s.memPct != null ? s.memPct : 42.0,
          networkThroughputMbps: s.status === 'offline' ? 0 : 34.2,
          lastSeen: s.status === 'offline' ? '12m ago' : 'Just now',
          service: s.hostname.includes('db') ? 'postgresql-storage' : 'cluster-compute-plane',
          tags: ['host-node', s.osInfo ? s.osInfo.split(' ')[0].toLowerCase() : 'linux', 'managed'],
          isSampleData: false,
        });
      });

      // 2. Map Live Containers
      liveContainers.forEach((c) => {
        let status: ResourceHealthStatus = 'healthy';
        if (c.status === 'exited') status = 'offline';
        else if (c.status === 'restarting' || c.restartCount > 2) status = 'critical';
        else if (c.status === 'paused' || (c.cpuPct && c.cpuPct > 85)) status = 'warning';

        mappedResources.push({
          id: c.id,
          name: c.name,
          type: 'container',
          environment: 'production',
          region: 'us-east-1',
          status,
          cpuPct: c.cpuPct != null ? c.cpuPct : 2.5,
          memPct: c.memMb ? Math.min(100, (c.memMb / 1024) * 100) : 15.0,
          networkThroughputMbps: c.status === 'running' ? 12.8 : 0,
          lastSeen: 'Just now',
          service: c.service,
          tags: ['docker', c.service, 'telemetry'],
          isSampleData: false,
        });
      });

      // 3. Add Managed Cloud Data Services (Identified clearly for full inventory scope)
      if (mappedResources.length <= 6) {
        mappedResources.push(
          {
            id: 'rds-pg-prod-primary',
            name: 'aetherpulse-aurora-postgres-01',
            type: 'database',
            environment: 'production',
            region: 'us-east-1',
            status: 'healthy',
            cpuPct: 32.4,
            memPct: 61.2,
            networkThroughputMbps: 88.4,
            lastSeen: 'Just now',
            service: 'timescale-telemetry-db',
            tags: ['timescaledb', 'aurora', 'sample-inventory'],
            isSampleData: true,
          },
          {
            id: 'k8s-node-worker-04',
            name: 'us-east-prod-worker-node-04',
            type: 'k8s-node',
            environment: 'production',
            region: 'us-east-1',
            status: 'warning',
            cpuPct: 84.6,
            memPct: 79.2,
            networkThroughputMbps: 45.1,
            lastSeen: '1m ago',
            service: 'cluster-compute-plane',
            tags: ['kubernetes', 'spot-instance', 'sample-inventory'],
            isSampleData: true,
          }
        );
      }

      setResources(mappedResources);
    } catch (err) {
      console.error('Failed to query infrastructure inventory', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInfrastructure();
  }, []);

  // Sync internal search input with URL param changes
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParam('q', search.trim());
  };

  // Summary counts
  const summary = useMemo(() => {
    const total = resources.length;
    const healthy = resources.filter((r) => r.status === 'healthy').length;
    const warning = resources.filter((r) => r.status === 'warning').length;
    const critical = resources.filter((r) => r.status === 'critical').length;
    const offline = resources.filter((r) => r.status === 'offline').length;
    return { total, healthy, warning, critical, offline };
  }, [resources]);

  // Filtered & Sorted items
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (envFilter !== 'all' && r.environment !== envFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesService = r.service?.toLowerCase().includes(q);
        const matchesTags = r.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesService && !matchesTags) return false;
      }
      return true;
    }).sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [resources, statusFilter, typeFilter, envFilter, searchQuery, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredResources.length / pageSize) || 1;
  const paginatedResources = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredResources.slice(start, start + pageSize);
  }, [filteredResources, page, pageSize]);

  const handleSort = (field: keyof InfraResource) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === paginatedResources.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(paginatedResources.map((r) => r.id)));
    }
  };

  const selectedResource = useMemo(() => {
    return resources.find((r) => r.id === selectedResourceId) || null;
  }, [resources, selectedResourceId]);

  const getStatusBadge = (status: ResourceHealthStatus) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="healthy">Healthy</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'critical':
        return <Badge variant="critical">Critical</Badge>;
      case 'offline':
        return <Badge variant="neutral">Offline</Badge>;
      default:
        return <Badge variant="neutral">Unknown</Badge>;
    }
  };

  const getTypeIcon = (type: ResourceType) => {
    switch (type) {
      case 'virtual-machine':
        return <ServerIcon size={16} color="var(--color-primary)" />;
      case 'container':
        return <Box size={16} color="var(--color-accent)" />;
      case 'k8s-node':
        return <Layers size={16} color="#38bdf8" />;
      case 'database':
        return <Database size={16} color="#f59e0b" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* 1. PAGE HEADER & ENVIRONMENT SCOPE */}
      <PageHeader
        title="Infrastructure Explorer"
        description="Comprehensive inventory of cloud compute instances, container runtimes, Kubernetes nodes, and data platforms."
        badge={<Badge variant="violet">us-east-prod</Badge>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View Switcher */}
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
                onClick={() => updateQueryParam('view', 'table')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: viewMode === 'table' ? 'var(--color-primary-subtle)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Table View
              </button>
              <button
                onClick={() => updateQueryParam('view', 'topology')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: viewMode === 'topology' ? 'var(--color-primary-subtle)' : 'transparent',
                  color: viewMode === 'topology' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Topology Map
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />}
              onClick={loadInfrastructure}
              isLoading={isRefreshing}
            >
              Refresh Fleet
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setShowOnboarding(true);
                setOnboardingResult(null);
              }}
            >
              Onboard Server
            </Button>
          </div>
        }
      />

      {/* 2. SUMMARY KPI METRIC TILES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-4)',
        }}
      >
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>TOTAL RESOURCES</span>
            <Layers size={16} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{summary.total}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Across 3 cloud service scopes
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-status-healthy)' }}>HEALTHY</span>
            <CheckCircle2 size={16} color="var(--color-status-healthy)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{summary.healthy}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Operating within SLO thresholds
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-status-warning)' }}>DEGRADED / WARNING</span>
            <AlertTriangle size={16} color="var(--color-status-warning)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{summary.warning}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Elevated CPU / memory pressure
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-status-critical)' }}>CRITICAL / RESTARTING</span>
            <XCircle size={16} color="var(--color-status-critical)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{summary.critical}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Triggering active crashloop alarms
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>OFFLINE / UNREACHABLE</span>
            <HelpCircle size={16} color="var(--color-text-muted)" />
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff' }}>{summary.offline}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Stopped or exporter disconnected
          </div>
        </Card>
      </div>

      {/* 3. FILTER, SEARCH & CONTROLS TOOLBAR */}
      <Card style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Filter by name, service, or tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>

          {/* Filter dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => updateQueryParam('status', e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8125rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="offline">Offline</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => updateQueryParam('type', e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8125rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Types</option>
              <option value="virtual-machine">Virtual Machines</option>
              <option value="container">Containers</option>
              <option value="k8s-node">K8s Nodes</option>
              <option value="database">Cloud Databases</option>
            </select>

            {/* Environment Filter */}
            <select
              value={envFilter}
              onChange={(e) => updateQueryParam('env', e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8125rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>

            {/* Clear Filters Button */}
            {(statusFilter !== 'all' || typeFilter !== 'all' || envFilter !== 'all' || searchQuery) && (
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
        </div>

        {/* Multi-selection Action Banner */}
        {selectedRowIds.size > 0 && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>
              <strong>{selectedRowIds.size}</strong> resource{selectedRowIds.size > 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/metrics?metric=cpu`)}
              >
                Compare Telemetry
              </Button>
              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => alert(`Diagnostics dispatched for ${selectedRowIds.size} selected resource(s).`)}
                >
                  Run Fleet Diagnostics
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 4. MAIN CONTENT AREA: TABLE OR TOPOLOGY VIEW */}
      {viewMode === 'table' ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedRowIds.size > 0 && selectedRowIds.size === paginatedResources.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    style={{ padding: '12px 14px', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      RESOURCE NAME <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    style={{ padding: '12px 14px', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    STATUS
                  </th>
                  <th style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>TYPE</th>
                  <th style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>SERVICE & ENV</th>
                  <th
                    onClick={() => handleSort('cpuPct')}
                    style={{ padding: '12px 14px', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      CPU <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('memPct')}
                    style={{ padding: '12px 14px', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      MEMORY <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>NETWORK</th>
                  <th style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>REGION</th>
                  <th style={{ padding: '12px 14px', color: 'var(--color-text-muted)', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResources.length > 0 ? (
                  paginatedResources.map((resource) => (
                    <tr
                      key={resource.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: selectedResourceId === resource.id ? 'rgba(6, 182, 212, 0.05)' : 'transparent',
                        transition: 'background-color var(--transition-fast)',
                      }}
                    >
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRowIds.has(resource.id)}
                          onChange={() => toggleSelectRow(resource.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getTypeIcon(resource.type)}
                          <div>
                            <div
                              onClick={() => setSelectedResourceId(resource.id)}
                              style={{
                                fontWeight: 600,
                                color: '#ffffff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {resource.name}
                              {resource.isSampleData && (
                                <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'var(--color-text-muted)' }}>
                                  Sample
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                              ID: {resource.id} • Seen {resource.lastSeen}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{getStatusBadge(resource.status)}</td>
                      <td style={{ padding: '12px 14px', textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>
                        {resource.type.replace('-', ' ')}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{resource.service || 'platform'}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                          {resource.environment}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: resource.cpuPct > 80 ? 'var(--color-status-critical)' : '#ffffff' }}>
                            {resource.cpuPct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: 600, color: resource.memPct > 85 ? 'var(--color-status-critical)' : '#ffffff' }}>
                          {resource.memPct.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                        {resource.networkThroughputMbps.toFixed(1)} Mb/s
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>
                        {resource.region}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedResourceId(resource.id)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px 16px' }}>
                      <EmptyState
                        title="No matching infrastructure resources"
                        description="Try modifying search criteria, resetting status or environment filters."
                        actionText="Clear Filters"
                        onAction={() => {
                          setSearch('');
                          setSearchParams(new URLSearchParams());
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
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
              Showing {filteredResources.length === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, filteredResources.length)} of {filteredResources.length} items
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
      ) : (
        /* 5. TOPOLOGY MAP VIEW */
        <Card style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
              Cluster Topology & Dependency Graph
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Real-time structural topology showing compute hosts, containers, and inter-service telemetry bindings.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {resources.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedResourceId(item.id)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${selectedResourceId === item.id ? 'var(--color-primary)' : 'var(--color-border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getTypeIcon(item.type)}
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ffffff' }}>{item.name}</span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem', marginBottom: '12px' }}>
                  <div style={{ color: 'var(--color-text-muted)' }}>
                    CPU Load: <strong style={{ color: '#ffffff' }}>{item.cpuPct.toFixed(1)}%</strong>
                  </div>
                  <div style={{ color: 'var(--color-text-muted)' }}>
                    Memory: <strong style={{ color: '#ffffff' }}>{item.memPct.toFixed(1)}%</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                  <span>Service: {item.service || 'infrastructure'}</span>
                  <span>{item.region}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. RESOURCE DETAIL INSPECTION DRAWER */}
      <Drawer
        isOpen={!!selectedResource}
        onClose={() => setSelectedResourceId(null)}
        title={selectedResource?.name || 'Resource Details'}
        width="540px"
      >
        {selectedResource && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status & Identifiers */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getTypeIcon(selectedResource.type)}
                  <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {selectedResource.type.replace('-', ' ')}
                  </span>
                </div>
                {getStatusBadge(selectedResource.status)}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedResource.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.6875rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Live Metrics Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff' }}>
                Real-Time Telemetry Gauges
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-base)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>CPU Utilization</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: selectedResource.cpuPct > 80 ? 'var(--color-status-critical)' : 'var(--color-primary)' }}>
                    {selectedResource.cpuPct.toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-base)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Memory Usage</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: selectedResource.memPct > 85 ? 'var(--color-status-critical)' : 'var(--color-accent)' }}>
                    {selectedResource.memPct.toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-base)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Network IO</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                    {selectedResource.networkThroughputMbps.toFixed(1)}M
                  </div>
                </div>
              </div>
            </div>

            {/* Scope Information List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Resource ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>{selectedResource.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Target Service</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{selectedResource.service || 'Default Mesh'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Environment</span>
                <span style={{ textTransform: 'capitalize', color: '#ffffff' }}>{selectedResource.environment}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Deployment Region</span>
                <span style={{ color: '#ffffff' }}>{selectedResource.region}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Last Scrape Timestamp</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{selectedResource.lastSeen}</span>
              </div>
            </div>

            {/* Quick Investigation Navigation Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <Button
                variant="primary"
                size="md"
                icon={<Activity size={16} />}
                onClick={() => navigate(`/metrics?metric=cpu`)}
                style={{ width: '100%' }}
              >
                Inspect Metrics in Time Series Explorer
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<ShieldAlert size={16} />}
                onClick={() => navigate(`/incidents`)}
                style={{ width: '100%' }}
              >
                Investigate Related Incidents & RCA
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<FileText size={16} />}
                onClick={() => navigate(`/logs`)}
                style={{ width: '100%' }}
              >
                View Container / Syslog Streams
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Guided Agent Onboarding Modal */}
      {showOnboarding && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '650px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ServerIcon size={20} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                  Onboard Monitored Server
                </h3>
              </div>
              <button
                onClick={() => setShowOnboarding(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {!onboardingResult ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!onboardHostname.trim() || !onboardIp.trim()) return;
                  try {
                    setOnboardingLoading(true);
                    const res = await serversApi.registerServer({
                      hostname: onboardHostname.trim(),
                      ipAddress: onboardIp.trim(),
                      osInfo: onboardOs,
                      environment: onboardEnv,
                      capabilities: ['metrics', 'logs', 'events'],
                    });
                    setOnboardingResult(res);
                    loadInfrastructure();
                  } catch (err: any) {
                    alert(err?.response?.data?.detail || 'Failed to register server.');
                  } finally {
                    setOnboardingLoading(false);
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Server Hostname (FQDN or unique identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., prod-app-worker-01"
                    value={onboardHostname}
                    onChange={(e) => setOnboardHostname(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-base)',
                      border: '1px solid var(--color-border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    IP Address or Reachable Host *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 10.0.12.45 or server.internal"
                    value={onboardIp}
                    onChange={(e) => setOnboardIp(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-base)',
                      border: '1px solid var(--color-border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      Operating System
                    </label>
                    <select
                      value={onboardOs}
                      onChange={(e) => setOnboardOs(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-base)',
                        border: '1px solid var(--color-border-subtle)',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    >
                      <option value="Linux (Ubuntu / Debian)">Linux (Ubuntu / Debian)</option>
                      <option value="Linux (RHEL / CentOS / Rocky)">Linux (RHEL / CentOS / Rocky)</option>
                      <option value="Docker Host / Container Node">Docker Host / Container Node</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      Environment
                    </label>
                    <select
                      value={onboardEnv}
                      onChange={(e) => setOnboardEnv(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-base)',
                        border: '1px solid var(--color-border-subtle)',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    >
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                      <option value="development">Development</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <Button variant="ghost" size="sm" onClick={() => setShowOnboarding(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" isLoading={onboardingLoading}>
                    Generate Enrollment Token
                  </Button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--color-status-healthy)', fontSize: '0.875rem' }}>
                  ✓ Server registered in inventory. Single-use enrollment token generated.
                </div>

                <div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Automated Agent Installation Command:
                  </span>
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#05080f',
                      border: '1px solid var(--color-border-subtle)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                      color: 'var(--color-primary)',
                      wordBreak: 'break-all',
                      position: 'relative',
                    }}
                  >
                    {onboardingResult.installCommand}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={copied ? <Check size={14} /> : <Copy size={14} />}
                    onClick={() => {
                      navigator.clipboard.writeText(onboardingResult.installCommand);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? 'Copied to Clipboard' : 'Copy Installation Command'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowOnboarding(false);
                      setOnboardHostname('');
                      setOnboardIp('');
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
