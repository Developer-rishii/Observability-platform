import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/services';
import { 
  Radio, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Server 
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    const errors: { fullName?: string; email?: string; password?: string; confirmPassword?: string } = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid work email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setIsLoading(true);

    try {
      await authApi.register(email.trim(), password, fullName.trim());
      setIsSuccess(true);
    } catch (err: any) {
      if (!err.response) {
        setError('Network error: Unable to reach authentication service.');
      } else {
        setError(err.response?.data?.detail || err.response?.data?.message || 'Registration failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 480px) 1fr',
        backgroundColor: 'var(--color-bg-base)',
        color: '#ffffff',
      }}
    >
      {/* FORM COLUMN */}
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
        <div style={{ marginBottom: '28px' }}>
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
            Create an Account
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Provision access to the autonomous AI-powered cloud observability platform.
          </p>
        </div>

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

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-status-healthy)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>
              Check your inbox
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              We've dispatched an activation link to <strong style={{ color: '#fff' }}>{email}</strong>. 
              Please click the link in your email to verify your address before logging in.
            </p>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md" style={{ width: '100%' }}>
                Go to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="signup-name"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <UserIcon
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: fieldErrors.fullName ? 'var(--color-status-critical)' : 'var(--color-text-muted)',
                  }}
                />
                <input
                  id="signup-name"
                  type="text"
                  placeholder="Alex Rivera"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-base)',
                    border: `1px solid ${fieldErrors.fullName ? 'var(--color-status-critical)' : 'var(--color-border-subtle)'}`,
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>
              {fieldErrors.fullName && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.fullName}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="signup-email"
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
                  id="signup-email"
                  type="email"
                  placeholder="alex@enterprise.corp"
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
              <label
                htmlFor="signup-password"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Password (min 8 characters)
              </label>
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
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
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

            <div>
              <label
                htmlFor="signup-confirm-password"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: fieldErrors.confirmPassword ? 'var(--color-status-critical)' : 'var(--color-text-muted)',
                  }}
                />
                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-base)',
                    border: `1px solid ${fieldErrors.confirmPassword ? 'var(--color-status-critical)' : 'var(--color-border-subtle)'}`,
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.confirmPassword}
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
              Register Account
            </Button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Sign in
                </Link>
              </span>
            </div>
          </form>
        )}
      </div>

      {/* VISUAL COLUMN */}
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
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>Isolated Tenant Workspaces</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-status-healthy)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-status-healthy)' }} />
                ENCRYPTED
              </span>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Registering an enterprise account gives your team full visibility across containerized microservices, 
              real-time telemetry streams, and automatic root-cause correlation.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border-subtle)' }}>
            <ShieldCheck size={20} color="var(--color-status-healthy)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <span style={{ color: '#ffffff', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                Mandatory Email Verification
              </span>
              All new registrations require cryptographic token validation via SMTP to safeguard operational infrastructure against unauthorized telemetry access.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
