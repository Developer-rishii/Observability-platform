import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import '../styles/tokens.css';

const DashboardLayout: React.FC = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', background: 'var(--color-surface)', padding: 'var(--spacing-4)' }}>
        <h2>Observability Platform</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-8)' }}>
          <Link to="/dashboard" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>Dashboard</Link>
          <Link to="/incidents" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>Incidents</Link>
        </nav>
      </aside>
      
      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{ height: '60px', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', padding: '0 var(--spacing-4)', borderBottom: '1px solid var(--color-background)' }}>
          <div>Welcome, User</div>
        </header>
        
        {/* Page Content */}
        <main style={{ padding: 'var(--spacing-4)', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
