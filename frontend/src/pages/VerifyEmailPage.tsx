import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../api/services';
import { 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Mail, 
  ArrowRight 
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'resend'>('verifying');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token in URL link. Please check your verification link or request a new one.');
      return;
    }

    const executeVerification = async () => {
      try {
        const res = await authApi.verifyEmail(token);
        setStatus('success');
        setMessage(res.message || 'Email verified successfully. You can now log into your console.');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Verification token is invalid or has expired.');
      }
    };

    executeVerification();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setResendLoading(true);
    try {
      await authApi.resendVerification(resendEmail.trim());
      setResendSuccess(true);
    } catch {
      // Always treat as success to avoid user enumeration
      setResendSuccess(true);
    } finally {
      setResendLoading(false);
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
          maxWidth: '460px',
          padding: '36px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}
      >
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '24px' }}>
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

        {status === 'verifying' && (
          <div>
            <Loader2
              size={40}
              color="var(--color-primary)"
              style={{
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px auto',
              }}
            />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
              Verifying Your Email
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Validating token against cryptographically secure ledger...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
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
              Email Verified Successfully
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
              {message}
            </p>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md" icon={<ArrowRight size={16} />} style={{ width: '100%' }}>
                Sign In to Console
              </Button>
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--color-status-critical)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
              Verification Failed
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
              {message}
            </p>

            {resendSuccess ? (
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: 'var(--color-status-healthy)',
                  fontSize: '0.8125rem',
                  marginBottom: '16px',
                }}
              >
                If an unverified account matches that address, a new verification link has been dispatched!
              </div>
            ) : (
              <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Enter your email to request a new verification link:
                </p>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                    }}
                  />
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-base)',
                      border: '1px solid var(--color-border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <Button type="submit" variant="secondary" size="md" isLoading={resendLoading}>
                  Resend Verification Email
                </Button>
              </form>
            )}

            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm" style={{ width: '100%' }}>
                Return to Login
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
