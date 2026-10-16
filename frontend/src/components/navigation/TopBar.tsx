import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { systemApi } from '../../api/services';
import type { SystemHealth } from '../../types';
import { Bell, Search, ChevronRight, Menu } from 'lucide-react';
import { TimeRangePicker, type TimeRangeOption } from '../ui/TimeRangePicker';

interface TopBarProps {
  onToggleMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileMenu }) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>(30);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const fetchHealth = async () => {
      try {
        const data = await systemApi.getHealth();
        if (isMounted) setHealth(data);
      } catch {
        if (isMounted) setHealth(null);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Format breadcrumbs from path
  const pathParts = location.pathname.split('/').filter(Boolean);

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--spacing-6)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="topbar-mobile-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        )}

        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', overflow: 'hidden' }}>
          <Link to="/dashboard" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Console
          </Link>
          {pathParts.map((part, index) => {
            const isLast = index === pathParts.length - 1;
            const to = '/' + pathParts.slice(0, index + 1).join('/');
            const label = part.charAt(0).toUpperCase() + part.slice(1);

            return (
              <React.Fragment key={to}>
                <ChevronRight size={13} color="var(--color-text-muted)" />
                {isLast ? (
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                ) : (
                  <Link to={to} style={{ color: 'var(--color-text-muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    {label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right Controls: Global Search, Time Window Picker, Health Badge, Notifications */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Global Search Input */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search telemetry..."
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontSize: '0.75rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Global TimeRangePicker */}
        <TimeRangePicker value={timeRange} onChange={setTimeRange} />

        {/* Engine Health Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: '0.75rem',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: health?.db && health?.prometheus ? 'var(--color-status-healthy)' : 'var(--color-status-warning)',
              boxShadow: health?.db && health?.prometheus ? '0 0 8px var(--color-status-healthy)' : '0 0 8px var(--color-status-warning)',
              display: 'inline-block',
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.6875rem' }}>Engine:</span>
          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.6875rem' }}>
            {health?.db && health?.prometheus ? 'Healthy' : 'Degraded'}
          </span>
        </div>

        {/* Bell Button */}
        <button
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '6px',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Active Alerts"
          aria-label="Active Alerts"
        >
          <Bell size={15} />
        </button>
      </div>
    </header>
  );
};
