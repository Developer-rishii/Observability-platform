import React, { useState, useEffect } from 'react';
import { Search, Play, Pause, Terminal, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { logsApi, type LogEntry } from '../api/services';

export const LogExplorer: React.FC = () => {
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [minutes, setMinutes] = useState<number>(60);
  const [isLiveTailing, setIsLiveTailing] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lokiHealthy, setLokiHealthy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await logsApi.listLogs({
        q: query.trim() || undefined,
        level: levelFilter !== 'ALL' ? levelFilter : undefined,
        minutes: minutes,
        limit: 150,
      });
      setLogs(res);
      setLokiHealthy(true);
    } catch (err: any) {
      setLokiHealthy(false);
      setError(err?.response?.data?.detail || 'Failed to fetch logs from Loki storage backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter, minutes]);

  // Live polling interval when tailing is active
  useEffect(() => {
    if (!isLiveTailing) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [isLiveTailing, query, levelFilter, minutes]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
            Log Explorer
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Aggregated system & container logs streamed live from Grafana Loki storage engine.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={fetchLogs}
          >
            Refresh
          </Button>
          <Button
            variant={isLiveTailing ? 'primary' : 'secondary'}
            size="sm"
            icon={isLiveTailing ? <Pause size={14} /> : <Play size={14} />}
            onClick={() => setIsLiveTailing(!isLiveTailing)}
          >
            {isLiveTailing ? 'Streaming (5s)' : 'Resume Stream'}
          </Button>
        </div>
      </div>

      {/* Loki Health Status Banner if degraded */}
      {lokiHealthy === false && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-warning-bg)',
            border: '1px solid var(--color-status-warning-border)',
            color: 'var(--color-status-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
          }}
        >
          <AlertTriangle size={18} />
          <span>
            {error || 'Loki backend is currently unreachable. Please ensure the Loki service is active.'}
          </span>
        </div>
      )}

      {/* Query Bar */}
      <Card style={{ padding: 'var(--spacing-4)' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={16}
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
              placeholder="Search log messages, services, error traces (press Enter)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: '#ffffff',
                fontSize: '0.8125rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontSize: '0.8125rem',
              outline: 'none',
            }}
          >
            <option value="ALL">All Severities</option>
            <option value="ERROR">ERROR / CRITICAL</option>
            <option value="WARN">WARN only</option>
            <option value="INFO">INFO only</option>
            <option value="DEBUG">DEBUG only</option>
          </select>

          <select
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontSize: '0.8125rem',
              outline: 'none',
            }}
          >
            <option value={15}>Past 15 Minutes</option>
            <option value={30}>Past 30 Minutes</option>
            <option value={60}>Past 1 Hour</option>
            <option value={180}>Past 3 Hours</option>
            <option value={1440}>Past 24 Hours</option>
          </select>

          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </form>
      </Card>

      {/* Log Terminal Window */}
      <Card style={{ backgroundColor: '#05080f', border: '1px solid var(--color-border-subtle)', padding: 'var(--spacing-4)', fontFamily: 'ui-monospace, monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={14} color="var(--color-primary)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
              LIVE LOKI STREAM — {logs.length} RECORDS DISPLAYED
            </span>
          </div>
          {isLiveTailing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-status-healthy)', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-status-healthy)' }}>TAILING</span>
            </div>
          )}
        </div>

        {logs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', maxHeight: '550px', overflowY: 'auto' }}>
            {logs.map((log) => (
              <div key={log.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.6875rem',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    backgroundColor: log.level === 'ERROR' ? 'var(--color-status-critical-bg)' : log.level === 'WARN' ? 'var(--color-status-warning-bg)' : 'rgba(255,255,255,0.06)',
                    color: log.level === 'ERROR' ? 'var(--color-status-critical)' : log.level === 'WARN' ? 'var(--color-status-warning)' : 'var(--color-text-secondary)',
                  }}
                >
                  {log.level}
                </span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  [{log.service}]
                </span>
                <span style={{ color: '#e2e8f0', flex: 1, wordBreak: 'break-all' }}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--color-text-muted)' }}>
            {loading ? 'Querying Loki log stream...' : 'No log lines matched the query window.'}
          </div>
        )}
      </Card>
    </div>
  );
};
