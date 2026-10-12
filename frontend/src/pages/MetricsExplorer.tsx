import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
import { Button } from '../components/ui/Button';
import { metricsApi } from '../api/services';
import type { MetricSeries } from '../types';

export const MetricsExplorer: React.FC = () => {
  const [metricName, setMetricName] = useState<string>('cpu');
  const [minutes, setMinutes] = useState<number>(30);
  const [series, setSeries] = useState<MetricSeries | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await metricsApi.queryRange(metricName, minutes);
      setSeries(res);
    } catch (err) {
      console.error('Failed to query metrics range', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [metricName, minutes]);

  const chartData = (series?.points || []).map((p) => {
    const d = new Date(p.t);
    return {
      time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      value: Number(p.v.toFixed(2)),
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
            Metrics Explorer
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Deep-dive multi-resolution telemetry queries directly against the Prometheus engine.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={fetchMetrics}>
          Run Query
        </Button>
      </div>

      {/* Query Bar */}
      <Card style={{ padding: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              Telemetry Metric
            </label>
            <select
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="cpu">Host CPU Utilization (Percentage)</option>
              <option value="memory">Host Memory Usage (Percentage)</option>
              <option value="disk">Host Disk Space (Percentage)</option>
              <option value="network_ingress">Network Ingress Rate (MB/s)</option>
              <option value="network_egress">Network Egress Rate (MB/s)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              Query Time Window
            </label>
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value={15}>Past 15 Minutes</option>
              <option value={30}>Past 30 Minutes</option>
              <option value={60}>Past 1 Hour</option>
              <option value={360}>Past 6 Hours</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Chart Canvas */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#ffffff' }}>
              {series?.label || metricName.toUpperCase()}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Unit: {series?.unit || '%'} • {chartData.length} Scrape data points collected
            </span>
          </div>
          {series?.threshold && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', fontWeight: 600 }}>
              Alarm Baseline: {series.threshold}%
            </div>
          )}
        </div>

        <div style={{ height: '340px', width: '100%' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricExplorerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
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
                  domain={[0, 100]}
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
                {series?.threshold && (
                  <ReferenceLine
                    y={series.threshold}
                    stroke="var(--color-status-critical)"
                    strokeDasharray="4 4"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#metricExplorerGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
              {loading ? 'Evaluating time-series expression...' : 'No Prometheus samples available for window.'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
