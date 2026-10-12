import React from 'react';
import { Card } from './Card';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  height?: number | string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  action,
  children,
  height = 280,
}) => {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-4)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {subtitle}
            </div>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      <div style={{ width: '100%', height, minHeight: height, position: 'relative' }}>
        {children}
      </div>
    </Card>
  );
};
