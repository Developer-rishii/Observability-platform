import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: 'cyan' | 'violet' | 'none';
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  glow = 'none',
  className = '',
  style,
  ...props
}) => {
  const getGlowShadow = () => {
    if (glow === 'cyan') return 'var(--shadow-glow-cyan)';
    if (glow === 'violet') return 'var(--shadow-glow-violet)';
    return 'var(--shadow-md)';
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-card)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: getGlowShadow(),
        padding: 'var(--spacing-5)',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};
