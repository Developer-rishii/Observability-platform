import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/SearchInput';
import { RefreshCw, Radio } from 'lucide-react';
import { eventsApi, type EventEntry } from '../api/services';
import { formatLocalTime, formatLocalDate } from '../utils/dateUtils';

export const EventsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await eventsApi.listEvents({
        q: search.trim() || undefined,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        limit: 100,
      });
      setEvents(res);
    } catch (err) {
      console.error('Failed to query events from PostgreSQL database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [severityFilter]);

  // Polling stream every 6 seconds when live
  useEffect(() => {
    if (!isAutoRefreshing) return;
    const interval = setInterval(() => {
      fetchEvents();
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoRefreshing, search, severityFilter]);

  const columns: Column<EventEntry>[] = [
    {
      key: 'severity',
      header: 'Severity',
      width: '120px',
      render: (row) => (
        <Badge variant={row.severity === 'critical' ? 'critical' : row.severity === 'warning' ? 'warning' : 'info'}>
          {row.severity.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: '180px',
      render: (row) => (
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {formatLocalTime(row.timestamp)} ({formatLocalDate(row.timestamp)})
        </span>
      ),
    },
    {
      key: 'eventType',
      header: 'Event Type',
      width: '180px',
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
          {row.eventType}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'Source Service',
      width: '180px',
      render: (row) => (
        <span style={{ fontWeight: 600, color: '#ffffff' }}>
          {row.service || (row.containerName ? `container:${row.containerName}` : 'system')}
        </span>
      ),
    },
    {
      key: 'message',
      header: 'Event Description & Context',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ color: 'var(--color-text-primary)', fontSize: '0.8125rem', fontWeight: 500 }}>
            {row.message}
          </span>
          {row.containerName && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Container: {row.containerName}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      <PageHeader
        title="Docker & Cluster Events"
        description="Persisted PostgreSQL operational lifecycle events, container exits, restarts, and anomaly signals."
        badge={
          <Badge variant="violet">
            <Radio size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            PostgreSQL Event Stream
          </Badge>
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={fetchEvents}
            >
              Refresh
            </Button>
            <Button
              variant={isAutoRefreshing ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setIsAutoRefreshing(!isAutoRefreshing)}
            >
              {isAutoRefreshing ? 'Live Stream (6s)' : 'Resume Stream'}
            </Button>
          </div>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <SearchInput
          placeholder="Filter cluster event stream (type, service, description)..."
          value={search}
          onSearchChange={(val) => {
            setSearch(val);
            // Re-fetch on filter
            eventsApi.listEvents({
              q: val.trim() || undefined,
              severity: severityFilter !== 'ALL' ? severityFilter : undefined,
              limit: 100,
            }).then(setEvents);
          }}
        />

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Severity:</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontSize: '0.8125rem',
              outline: 'none',
            }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical only</option>
            <option value="WARNING">Warning only</option>
            <option value="INFO">Info only</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={events}
        keyExtractor={(item) => item.id}
        emptyTitle="No cluster events recorded"
        emptyDescription="No events match the current criteria or the event stream is operating within normal parameters."
      />
    </div>
  );
};
