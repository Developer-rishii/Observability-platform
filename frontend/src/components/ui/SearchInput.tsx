import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearchChange?: (val: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Search...',
  value,
  onChange,
  onSearchChange,
  style,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e);
    if (onSearchChange) onSearchChange(e.target.value);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
      <Search
        size={15}
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-text-muted)',
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '8px 12px 8px 36px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-primary)',
          fontSize: '0.8125rem',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
        {...props}
      />
    </div>
  );
};
