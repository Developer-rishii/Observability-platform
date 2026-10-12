import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/services';
import { 
  Radio, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight 
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    const errors: { password?: string; confirmPassword?: string } = {};

    if (!newPassword) {
      errors.password = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing reset token. Please check the link from your email.');
      return;
    }

    if (!validate()) return;

    setIsLoading(true);

    try {
      await authApi.resetPassword(token, newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password. Link may be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-base)',
        color: '#ffffff',
        padding: '24px',
        backgroundImage: `
          radial-gradient(circle at 50% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 50% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)
        `,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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

          <h1 style={{ margin: '0 0 6px 0', fontSize: '1.5rem', fontWeight: 700 }}>
            Set New Password
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Choose a secure, strong password for your administrator account.
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
          <div style={{ textAlign: 'center' }}>
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
              Password Reset Complete
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
              Your password has been updated securely. You can now log into your console with your new credentials.
            </p>
            <Button
              variant="primary"
              size="md"
              icon={<ArrowRight size={16} />}
              onClick={() => navigate('/login')}
              style={{ width: '100%' }}
            >
              Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleReset} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="new-password"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                New Password (min 8 characters)
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
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
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
                htmlFor="confirm-password"
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
                  id="confirm-password"
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
              style={{ width: '100%', marginTop: '6px' }}
            >
              Update Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
