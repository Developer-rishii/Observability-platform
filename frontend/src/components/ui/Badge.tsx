import React from 'react';
import type { IncidentSeverity, IncidentStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'healthy' | 'warning' | 'critical' | 'info' | 'neutral' | 'violet';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  const getStyles = () => {
    switch (variant) {
      case 'healthy':
        return {
          bg: 'var(--color-status-healthy-bg)',
          color: 'var(--color-status-healthy)',
          border: 'var(--color-status-healthy-border)',
        };
      case 'warning':
        return {
          bg: 'var(--color-status-warning-bg)',
          color: 'var(--color-status-warning)',
          border: 'var(--color-status-warning-border)',
        };
      case 'critical':
        return {
          bg: 'var(--color-status-critical-bg)',
          color: 'var(--color-status-critical)',
          border: 'var(--color-status-critical-border)',
        };
      case 'info':
        return {
          bg: 'var(--color-status-info-bg)',
          color: 'var(--color-status-info)',
          border: 'var(--color-status-info-border)',
        };
      case 'violet':
        return {
          bg: 'rgba(139, 92, 246, 0.15)',
          color: '#a78bfa',
          border: 'rgba(139, 92, 246, 0.35)',
        };
      default:
        return {
          bg: 'rgba(255, 255, 255, 0.06)',
          color: 'var(--color-text-secondary)',
          border: 'var(--color-border-subtle)',
        };
    }
  };

  const styleConfig = getStyles();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        backgroundColor: styleConfig.bg,
        color: styleConfig.color,
        border: `1px solid ${styleConfig.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: IncidentSeverity }> = ({ severity }) => {
  const map: Record<IncidentSeverity, 'critical' | 'warning' | 'info' | 'neutral'> = {
    critical: 'critical',
    high: 'warning',
    medium: 'warning',
    low: 'info',
    info: 'neutral',
  };
  return <Badge variant={map[severity] || 'neutral'}>{severity}</Badge>;
};

export const StatusBadge: React.FC<{ status: IncidentStatus }> = ({ status }) => {
  const map: Record<IncidentStatus, 'critical' | 'warning' | 'info' | 'healthy'> = {
    open: 'critical',
    investigating: 'warning',
    candidate: 'info',
    resolved: 'healthy',
  };
  return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
};
