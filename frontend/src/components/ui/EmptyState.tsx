import React from 'react';
import { Inbox, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-10) var(--spacing-6)',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.01)',
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          marginBottom: '16px',
        }}
      >
        {icon || <Inbox size={24} />}
      </div>
      <h3
        style={{
          margin: '0 0 6px 0',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: '0 0 20px 0',
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          maxWidth: '380px',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {actionText && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Telemetry Engine Query Error',
  message,
  onRetry,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-8) var(--spacing-6)',
        textAlign: 'center',
        backgroundColor: 'var(--color-status-critical-bg)',
        border: '1px solid var(--color-status-critical-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-status-critical)',
          marginBottom: '12px',
        }}
      >
        <AlertCircle size={22} />
      </div>
      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-status-critical)' }}>
        {title}
      </h4>
      <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: '#fca5a5', maxWidth: '420px', lineHeight: 1.5 }}>
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry Query
        </Button>
      )}
    </div>
  );
};
