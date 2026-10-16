import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { 
  Radio, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Server,
  Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/Button';

type AuthMode = 'signin' | 'forgot' | 'reset-sent';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to requested protected page if available
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (mode === 'signin') {
      if (!password) {
        errors.password = 'Password is required.';
      } else if (password.length < 4) {
        errors.password = 'Password must be at least 4 characters.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setIsLoading(true);

    try {
      const data = await authApi.login(email.trim(), password);
      if (data?.accessToken && data?.user) {
        login(data.accessToken, data.user);
        navigate(from, { replace: true });
      } else {
        setError('Login succeeded but token payload was missing from server response.');
      }
    } catch (err: any) {
      if (!err.response) {
        setError('Network error: Unable to reach the backend service on port 8000.');
      } else if (err.response.status === 403 && err.response.data?.detail === 'email_not_verified') {
        setError('Your email address has not been verified yet. Please check your inbox or click below to re-send.');
      } else if (err.response.status === 401) {
        setError('Invalid email or password credentials. Please verify and try again.');
      } else if (err.response.status === 400 && err.response.data?.detail === 'Inactive user') {
        setError('This user account is inactive. Please contact your workspace administrator.');
      } else {
        setError(err.response?.data?.detail || err.response?.data?.message || 'Authentication failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setFieldErrors({ email: 'Please provide a valid email to receive reset instructions.' });
      return;
    }
    setFieldErrors({});
    setIsLoading(true);

    try {
      await authApi.forgotPassword(email.trim());
      setMode('reset-sent');
    } catch {
      // Always treat as reset sent to prevent user enumeration
      setMode('reset-sent');
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setFieldErrors({});
    setError('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 460px) 1fr',
        backgroundColor: 'var(--color-bg-base)',
        color: '#ffffff',
      }}
    >
      {/* LEFT COLUMN: AUTHENTICATION FORM CARD */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'clamp(24px, 5vw, 48px)',
          backgroundColor: 'var(--color-bg-elevated)',
          borderRight: '1px solid var(--color-border-subtle)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Brand Header */}
        <div style={{ marginBottom: '32px' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '20px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow-cyan)',
              }}
            >
              <Radio size={20} color="#ffffff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#ffffff' }}>
              AetherPulse
            </span>
          </Link>

          <h1 style={{ margin: '0 0 6px 0', fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
            {mode === 'signin' && 'Sign in to Console'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset-sent' && 'Check your inbox'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {mode === 'signin' && 'Enter your credentials to access telemetry streams and incident investigation.'}
            {mode === 'forgot' && 'Enter your registered email address to receive password recovery instructions.'}
            {mode === 'reset-sent' && `We've dispatched recovery instructions to ${email}.`}
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-status-critical-bg)',
              border: '1px solid var(--color-status-critical-border)',
              color: 'var(--color-status-critical)',
              fontSize: '0.8125rem',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label
                htmlFor="auth-email"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Work Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: fieldErrors.email ? 'var(--color-status-critical)' : 'var(--color-text-muted)',
                  }}
                />
                <input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-base)',
                    border: `1px solid ${fieldErrors.email ? 'var(--color-status-critical)' : 'var(--color-border-subtle)'}`,
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color var(--transition-fast)',
                  }}
                />
              </div>
              {fieldErrors.email && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label
                  htmlFor="auth-password"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: fieldErrors.password ? 'var(--color-status-critical)' : 'var(--color-text-muted)',
                  }}
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-base)',
                    border: `1px solid ${fieldErrors.password ? 'var(--color-status-critical)' : 'var(--color-border-subtle)'}`,
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.password}
                </span>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              icon={<ArrowRight size={16} />}
              style={{ width: '100%', marginTop: '6px' }}
            >
              Sign in to Workspace
            </Button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Don't have an account?{' '}
                <Link to="/signup" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Create account
                </Link>
              </span>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label
                htmlFor="reset-email"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Registered Email
              </label>
              <input
                id="reset-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
              {fieldErrors.email && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <Button type="submit" variant="primary" size="md" isLoading={isLoading} style={{ width: '100%' }}>
              Send Recovery Link
            </Button>

            <button
              type="button"
              onClick={() => setMode('signin')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {/* RESET SENT CONFIRMATION */}
        {mode === 'reset-sent' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-status-healthy)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
              If an account with this email exists, an administrator key rotation token has been simulated.
            </p>
            <Button variant="secondary" size="md" onClick={() => setMode('signin')} style={{ width: '100%' }}>
              Return to Sign In
            </Button>
          </div>
        )}

        {/* DEVELOPER SEED ACCOUNTS QUICK-FILL */}
        <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
            <ShieldCheck size={14} color="var(--color-primary)" />
            <span>Developer Seed Sandbox Accounts:</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fillCredentials('admin@example.com', 'admin123')}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <div style={{ fontWeight: 600, color: '#ffffff' }}>Super Admin</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Full platform access</div>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('developer@example.com', 'dev123')}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <div style={{ fontWeight: 600, color: '#ffffff' }}>DevOps / SRE</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Investigation & RCA</div>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: CLOUD INFRASTRUCTURE VISUALIZATION (DESKTOP) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '48px',
          backgroundColor: 'var(--color-bg-base)',
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: `
            radial-gradient(circle at 40% 40%, rgba(6, 182, 212, 0.12) 0%, transparent 60%),
            radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.10) 0%, transparent 50%)
          `,
        }}
      >
        <div style={{ maxWidth: '520px', width: '100%', position: 'relative', zIndex: 2 }}>
          {/* Node telemetry visual card */}
          <div
            style={{
              padding: '28px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)',
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7), var(--shadow-glow-cyan)',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="var(--color-primary)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>Cluster Node: us-east-prod-01</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-status-healthy)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-status-healthy)' }} />
                ACTIVE
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8125rem', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem', display: 'block' }}>Prometheus Scrape</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>15.0s Interval</span>
              </div>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem', display: 'block' }}>ML Detector</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Isolation Forest</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
              <Sparkles size={16} color="#a78bfa" />
              <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                Explainable AI RCA initialized for anomaly correlation
              </span>
            </div>
          </div>

          {/* Security Guarantee callout */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)' }}>
            <ShieldCheck size={20} color="var(--color-status-healthy)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <span style={{ color: '#ffffff', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                Server-Side Authoritative Authorization
              </span>
              User permissions and JWT sessions are cryptographically signed and validated directly against PostgreSQL. Client-side role spoofing is strictly prevented.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
