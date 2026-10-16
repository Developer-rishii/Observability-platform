import React from 'react';

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height = '16px',
  width = '100%',
  borderRadius = 'var(--radius-sm)',
  style,
}) => {
  return (
    <div
      style={{
        height,
        width,
        borderRadius,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        animation: 'pulse 1.8s ease-in-out infinite',
        ...style,
      }}
    />
  );
};
