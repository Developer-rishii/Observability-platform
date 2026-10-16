import React from 'react';
import { Card } from './Card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  status?: 'healthy' | 'warning' | 'critical' | 'info';
  glow?: 'cyan' | 'violet' | 'none';
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon,
  status,
  glow = 'none',
  onClick,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy': return 'var(--color-status-healthy)';
      case 'warning': return 'var(--color-status-warning)';
      case 'critical': return 'var(--color-status-critical)';
      case 'info': return 'var(--color-status-info)';
      default: return 'var(--color-text-primary)';
    }
  };

  return (
    <Card
      glow={glow}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {label}
          </span>
          <div
            style={{
              fontSize: '1.875rem',
              fontWeight: 700,
              color: getStatusColor(),
              marginTop: '4px',
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </div>
        </div>
        {icon && (
          <div
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-primary)',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.75rem' }}>
        {trend && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontWeight: 600,
              color: trend.isPositive ? 'var(--color-status-healthy)' : 'var(--color-status-critical)',
            }}
          >
            {trend.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}
          </span>
        )}
        {subtext && <span style={{ color: 'var(--color-text-muted)' }}>{subtext}</span>}
      </div>
    </Card>
  );
};
