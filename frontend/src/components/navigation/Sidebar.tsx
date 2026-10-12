import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Server, 
  Activity, 
  FileText, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  Radio,
  Boxes,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavGroup {
  label: string;
  items: Array<{
    name: string;
    path: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    badge?: string;
  }>;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen = false, 
  onClose,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navGroups: NavGroup[] = [
    {
      label: 'Telemetry & Monitoring',
      items: [
        { name: 'Overview', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
        { name: 'Incidents & RCA', path: '/incidents', icon: <AlertTriangle size={18} /> },
        { name: 'Infrastructure', path: '/infrastructure', icon: <Server size={18} /> },
        { name: 'Services & Meshes', path: '/services', icon: <Boxes size={18} /> },
      ],
    },
    {
      label: 'Diagnostics & Observability',
      items: [
        { name: 'Metrics Explorer', path: '/metrics', icon: <Activity size={18} /> },
        { name: 'Log Streams', path: '/logs', icon: <FileText size={18} /> },
        { name: 'Docker Events', path: '/events', icon: <Layers size={18} /> },
      ],
    },
    {
      label: 'Platform Governance',
      items: [
        { name: 'Settings & RBAC', path: '/settings', icon: <Settings size={18} />, adminOnly: true },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar-container ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: isCollapsed ? '16px 12px' : 'var(--spacing-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--color-border-subtle)',
            minHeight: '64px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow-cyan)',
                flexShrink: 0,
              }}
              title="AetherPulse Observability"
            >
              <Radio size={18} color="#ffffff" />
            </div>
            {!isCollapsed && (
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.02em', color: '#ffffff', whiteSpace: 'nowrap' }}>
                  AetherPulse
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  Enterprise Observability
                </div>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="sidebar-close-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '6px',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Workspace / Tenant Selector */}
        {!isCollapsed && (
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-status-healthy)' }} />
                <span style={{ fontWeight: 600, color: '#ffffff' }}>us-east-prod</span>
              </div>
              <ChevronDown size={13} color="var(--color-text-muted)" />
            </div>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav
          style={{
            flex: 1,
            padding: isCollapsed ? '12px 8px' : 'var(--spacing-4) var(--spacing-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: isCollapsed ? '8px' : '16px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                {!isCollapsed && (
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      fontWeight: 700,
                      padding: '0 12px 6px',
                      letterSpacing: '0.08em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.label}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {visibleItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        title={isCollapsed ? item.name : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: isCollapsed ? 'center' : 'flex-start',
                          gap: '10px',
                          padding: isCollapsed ? '10px 0' : '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          textDecoration: 'none',
                          fontSize: '0.8125rem',
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                          backgroundColor: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                          border: isActive ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <span style={{ color: isActive ? 'var(--color-primary)' : 'inherit', display: 'flex', flexShrink: 0 }}>
                          {item.icon}
                        </span>
                        {!isCollapsed && (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Desktop Collapse / Expand Toggle Button */}
        {onToggleCollapse && (
          <div
            style={{
              padding: isCollapsed ? '8px 0' : '8px 12px',
              display: 'flex',
              justifyContent: isCollapsed ? 'center' : 'flex-end',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            <button
              onClick={onToggleCollapse}
              className="topbar-collapse-btn"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        )}

        {/* User Footer Profile */}
        <div
          style={{
            padding: isCollapsed ? '12px 8px' : 'var(--spacing-4)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {!isCollapsed ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-bg-surface-hover)',
                    border: '1px solid var(--color-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    flexShrink: 0,
                  }}
                >
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.fullName || user?.email || 'User'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    {isAdmin ? (
                      <span style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ShieldCheck size={12} /> Super Admin
                      </span>
                    ) : (
                      'SRE / DevOps'
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'all var(--transition-fast)',
                }}
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-bg-surface-hover)',
                  border: '1px solid var(--color-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                }}
                title={user?.email || 'User'}
              >
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
