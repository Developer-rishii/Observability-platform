import React from 'react';
import { Clock } from 'lucide-react';

export type TimeRangeOption = 15 | 30 | 60 | 360 | 1440;

interface TimeRangePickerProps {
  value: TimeRangeOption;
  onChange: (val: TimeRangeOption) => void;
}

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({ value, onChange }) => {
  const options: Array<{ label: string; value: TimeRangeOption }> = [
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '1h', value: 60 },
    { label: '6h', value: 360 },
    { label: '24h', value: 1440 },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-base)',
        border: '1px solid var(--color-border-subtle)',
        gap: '2px',
      }}
    >
      <div style={{ padding: '0 6px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
        <Clock size={13} />
      </div>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
              color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
              fontSize: '0.75rem',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
