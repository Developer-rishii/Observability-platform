import React from 'react';

const LoginPage: React.FC = () => {
  return (
    <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
      <h1>Login</h1>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', maxWidth: '300px', margin: '0 auto' }}>
        <input type="email" placeholder="Email" style={{ padding: 'var(--spacing-2)' }} />
        <input type="password" placeholder="Password" style={{ padding: 'var(--spacing-2)' }} />
        <button type="submit" style={{ padding: 'var(--spacing-2)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
          Login
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
