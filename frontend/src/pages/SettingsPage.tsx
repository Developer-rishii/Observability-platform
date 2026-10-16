import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  User,
  Lock,
  Users,
  Sliders,
  Plug,
  ClipboardList,
  Save,
  Check,
  X,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  Info,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { settingsApi } from '../api/services';
import type { UserDetail } from '../api/services';

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = 'profile' | 'security' | 'users' | 'detection' | 'integrations' | 'audit';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode; required?: boolean }> = ({
  htmlFor, children, required,
}) => (
  <label htmlFor={htmlFor} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
    {children}
    {required && <span style={{ color: 'var(--color-status-critical)', marginLeft: '3px' }}>*</span>}
  </label>
);

const baseInput: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
  backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border-default)',
  color: '#ffffff', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
};
const errorInput: React.CSSProperties = { ...baseInput, borderColor: 'var(--color-status-critical)' };

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon, title, description,
}) => (
  <div style={{ marginBottom: 'var(--spacing-6)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
        {icon}
      </div>
      <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#ffffff' }}>{title}</h2>
    </div>
    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{description}</p>
    <div style={{ height: '1px', backgroundColor: 'var(--color-border-subtle)', marginTop: '20px' }} />
  </div>
);

const AdminGate: React.FC<{ sectionTitle: string; icon: React.ReactNode; description: string }> = ({ sectionTitle, icon, description }) => (
  <div>
    <SectionTitle icon={icon} title={sectionTitle} description={description} />
    <Card style={{ padding: '32px', textAlign: 'center' }}>
      <Shield size={36} color="var(--color-text-muted)" style={{ marginBottom: '12px' }} />
      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>Admin Access Required</div>
      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>This section is restricted to platform administrators.</div>
    </Card>
  </div>
);

// ─── Section: Profile ─────────────────────────────────────────────────────────
const ProfileSection: React.FC<{ refreshUser: () => Promise<void> }> = ({ refreshUser }) => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const original = useRef(user?.fullName ?? '');
  const dirty = fullName !== original.current;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true); setError(null);
      await settingsApi.updateProfile(fullName);
      await refreshUser();
      original.current = fullName;
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to save profile.');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <SectionTitle icon={<User size={18} />} title="Personal Profile" description="Update your display name. Email addresses are set at registration and cannot be changed." />
      <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <FieldLabel htmlFor="p-email">Email Address</FieldLabel>
          <input id="p-email" type="text" value={user?.email ?? ''} disabled style={{ ...baseInput, opacity: 0.5, cursor: 'not-allowed' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>Contact your administrator to change your email address.</span>
        </div>
        <div>
          <FieldLabel htmlFor="p-name">Display Name</FieldLabel>
          <input id="p-name" type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setSaved(false); setError(null); }} placeholder="Your full name" style={baseInput} />
        </div>
        <div>
          <FieldLabel>Account Role</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border-subtle)' }}>
            <Shield size={15} color={user?.isAdmin ? 'var(--color-accent)' : 'var(--color-text-muted)'} />
            <span style={{ fontSize: '0.875rem', color: '#ffffff' }}>{user?.isAdmin ? 'Platform Administrator' : 'DevOps / SRE Operator'}</span>
            <span style={{ marginLeft: 'auto' }}>
              <Badge variant={user?.isAdmin ? 'violet' : 'info'}>{user?.isAdmin ? 'Admin' : 'Member'}</Badge>
            </span>
          </div>
        </div>
        <div>
          <FieldLabel>Verification Status</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: user?.isVerified ? 'var(--color-status-healthy)' : 'var(--color-status-warning)' }}>
            {user?.isVerified ? <Check size={16} /> : <AlertTriangle size={16} />}
            {user?.isVerified ? 'Email address verified' : 'Email address not verified'}
          </div>
        </div>
        {error && <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8125rem', color: 'var(--color-status-critical)' }}>{error}</div>}
        {saved && <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.8125rem', color: 'var(--color-status-healthy)' }}>✓ Profile saved successfully.</div>}
        {dirty && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={() => { setFullName(original.current); setError(null); }} icon={<X size={14} />}>Discard</Button>
            <Button variant="primary" size="sm" isLoading={saving} onClick={handleSave} icon={<Save size={14} />}>Save Changes</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Section: Security ────────────────────────────────────────────────────────
const SecuritySection: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ve, setVe] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!current) return 'Current password is required.';
    if (next.length < 8) return 'New password must be at least 8 characters.';
    if (next !== confirm) return 'Passwords do not match.';
    if (next === current) return 'New password must differ from the current password.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setVe(err); return; }
    try {
      setSaving(true); setError(null); setVe(null);
      await settingsApi.changePassword(current, next);
      setSuccess(true); setCurrent(''); setNext(''); setConfirm('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Password change failed.');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <SectionTitle icon={<Lock size={18} />} title="Security" description="Change your account password. Use a strong, unique password." />
      <div style={{ maxWidth: '440px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {(ve || error) && <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8125rem', color: 'var(--color-status-critical)', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={15} /> {ve || error}</div>}
          {success && <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.8125rem', color: 'var(--color-status-healthy)', display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={15} /> Password updated successfully.</div>}
          <div>
            <FieldLabel htmlFor="s-current" required>Current Password</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input id="s-current" type={showCurrent ? 'text' : 'password'} value={current} onChange={(e) => { setCurrent(e.target.value); setVe(null); setError(null); }} style={{ ...baseInput, paddingRight: '40px' }} autoComplete="current-password" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="s-new" required>New Password</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input id="s-new" type={showNext ? 'text' : 'password'} value={next} onChange={(e) => { setNext(e.target.value); setVe(null); }} style={{ ...(next.length > 0 && next.length < 8 ? errorInput : baseInput), paddingRight: '40px' }} autoComplete="new-password" />
              <button type="button" onClick={() => setShowNext(!showNext)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {next.length > 0 && next.length < 8 && <span style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', display: 'block', marginTop: '4px' }}>At least 8 characters ({next.length}/8)</span>}
          </div>
          <div>
            <FieldLabel htmlFor="s-confirm" required>Confirm New Password</FieldLabel>
            <input id="s-confirm" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setVe(null); }} style={confirm.length > 0 && confirm !== next ? errorInput : baseInput} autoComplete="new-password" />
            {confirm.length > 0 && confirm !== next && <span style={{ fontSize: '0.75rem', color: 'var(--color-status-critical)', display: 'block', marginTop: '4px' }}>Passwords do not match.</span>}
          </div>
          <Button variant="primary" type="submit" isLoading={saving} icon={<Lock size={14} />}>Update Password</Button>
        </form>
        <Card style={{ marginTop: '32px', padding: 'var(--spacing-4)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Security</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {[['Authentication', 'JWT Bearer (HS256)'], ['Token lifetime', '24 hours'], ['MFA', 'Not configured (planned)']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{k}</span><span style={{ color: '#ffffff' }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section: Users (admin) ────────────────────────────────────────────────────
const UsersSection: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { user: self } = useAuth();
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setUsers(await settingsApi.listUsers()); }
    catch { setError('Failed to load users.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!isAdmin) return <AdminGate sectionTitle="Users & Roles" icon={<Users size={18} />} description="Manage workspace members." />;

  const act = async (fn: () => Promise<UserDetail>, userId: number) => {
    try { setActionId(userId); const u = await fn(); setUsers((p) => p.map((x) => (x.id === u.id ? u : x))); }
    catch (e: any) { setError(e.response?.data?.detail ?? 'Action failed.'); }
    finally { setActionId(null); }
  };

  return (
    <div>
      <SectionTitle icon={<Users size={18} />} title="Users & Roles" description="Manage workspace members, roles, and account status. You cannot modify your own privileges." />
      {error && <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8125rem', color: 'var(--color-status-critical)', display: 'flex', justifyContent: 'space-between' }}><span>{error}</span><button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button></div>}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-muted)', padding: '40px' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading users…</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                {['USER', 'STATUS', 'ROLE', 'VERIFIED', 'JOINED', 'ACTIONS'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === self?.id;
                const busy = actionId === u.id;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', opacity: busy ? 0.6 : 1 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{u.fullName || '—'}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{u.email}</div>
                      {isSelf && <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)' }}>You</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}><Badge variant={u.isActive ? 'healthy' : 'neutral'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td style={{ padding: '12px 16px' }}><Badge variant={u.isAdmin ? 'violet' : 'info'}>{u.isAdmin ? 'Admin' : 'Member'}</Badge></td>
                    <td style={{ padding: '12px 16px', color: u.isVerified ? 'var(--color-status-healthy)' : 'var(--color-status-warning)' }}>{u.isVerified ? <Check size={15} /> : <X size={15} />}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {isSelf ? <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span> : (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button variant="ghost" size="sm" onClick={() => act(() => settingsApi.updateUserRole(u.id, !u.isAdmin), u.id)} icon={busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}>
                            {u.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => act(() => settingsApi.updateUserActive(u.id, !u.isActive), u.id)}>
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{users.length} user{users.length !== 1 ? 's' : ''} in workspace</div>
        </Card>
      )}
    </div>
  );
};

// ─── Section: Detection Config (admin) ────────────────────────────────────────
const CONFIG_META: Record<string, { label: string; desc: string; type: 'range' | 'text'; min: number; max: number; step: number; unit: string }> = {
  CPU_THRESHOLD_PCT:              { label: 'CPU Alert Threshold (%)',       desc: 'Sustained CPU breach percentage that triggers an incident.',                       type: 'range', min: 50, max: 99,   step: 1,    unit: '%' },
  MEM_THRESHOLD_PCT:              { label: 'Memory Alert Threshold (%)',     desc: 'Sustained memory breach percentage that triggers an incident.',                    type: 'range', min: 50, max: 99,   step: 1,    unit: '%' },
  DISK_THRESHOLD_PCT:             { label: 'Disk Alert Threshold (%)',       desc: 'Disk capacity percentage at which an incident is opened.',                        type: 'range', min: 50, max: 99,   step: 1,    unit: '%' },
  ANOMALY_THRESHOLD:              { label: 'Isolation Forest Cutoff',        desc: 'Higher score = fewer but more precise anomaly detections.',                       type: 'range', min: 0.5, max: 0.99, step: 0.01, unit: '' },
  DETECTION_INTERVAL_SECONDS:     { label: 'Detection Interval (s)',         desc: 'How frequently the detection engine runs.',                                       type: 'range', min: 5,  max: 300,  step: 5,    unit: 's' },
  DETECTION_CONSECUTIVE_BREACHES: { label: 'Breaches Before Alert',          desc: 'Consecutive threshold breaches required before an incident is opened.',           type: 'range', min: 1,  max: 10,   step: 1,    unit: '' },
  DETECTION_RECOVERY_CHECKS:      { label: 'Recovery Confirmation Checks',   desc: 'Consecutive healthy readings needed to close an incident.',                       type: 'range', min: 1,  max: 10,   step: 1,    unit: '' },
  CORRELATION_WINDOW_MINUTES:     { label: 'Correlation Window (min)',        desc: 'Time window for grouping related events into one incident.',                      type: 'range', min: 5,  max: 60,   step: 5,    unit: 'min' },
  LLM_TIMEOUT_SECONDS:            { label: 'AI Analysis Timeout (s)',         desc: 'Max seconds to wait for a Gemini response before returning an error.',            type: 'range', min: 10, max: 120,  step: 5,    unit: 's' },
  GEMINI_MODEL:                   { label: 'Gemini Model',                   desc: 'Gemini model identifier used for AI RCA (e.g. gemini-1.5-pro).',                 type: 'text',  min: 0,  max: 0,    step: 0,    unit: '' },
};

const DEFAULTS: Record<string, string> = {
  CPU_THRESHOLD_PCT: '80', MEM_THRESHOLD_PCT: '85', DISK_THRESHOLD_PCT: '90',
  ANOMALY_THRESHOLD: '0.95', DETECTION_INTERVAL_SECONDS: '15', DETECTION_CONSECUTIVE_BREACHES: '3',
  DETECTION_RECOVERY_CHECKS: '3', CORRELATION_WINDOW_MINUTES: '15', LLM_TIMEOUT_SECONDS: '30',
  GEMINI_MODEL: 'gemini-1.5-pro',
};

const DetectionSection: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [config, setConfig] = useState<Record<string, string>>({ ...DEFAULTS });
  const [original, setOriginal] = useState<Record<string, string>>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    settingsApi.getSystemConfig()
      .then((rows) => { const m = { ...DEFAULTS }; rows.forEach((r) => { m[r.key] = r.value; }); setConfig(m); setOriginal(m); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const save = async (key: string) => {
    try {
      setSaving(key); setError(null);
      await settingsApi.updateSystemConfig(key, config[key]);
      setOriginal((p) => ({ ...p, [key]: config[key] }));
      setSavedKey(key); setTimeout(() => setSavedKey(null), 2500);
    } catch (e: any) { setError(e.response?.data?.detail ?? 'Update failed.'); }
    finally { setSaving(null); }
  };

  if (!isAdmin) return <AdminGate sectionTitle="Detection Configuration" icon={<Sliders size={18} />} description="Anomaly detection and alerting thresholds." />;

  return (
    <div>
      <SectionTitle icon={<Sliders size={18} />} title="Detection Configuration" description="Adjust anomaly detection thresholds. Changes are stored in the database and override environment defaults at the next detection cycle." />
      {error && <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8125rem', color: 'var(--color-status-critical)' }}>{error}</div>}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-muted)', padding: '20px 0' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading configuration…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(CONFIG_META).map(([key, meta]) => {
            const val = config[key] ?? DEFAULTS[key] ?? '';
            const isDirty = val !== original[key];
            const isSaving = saving === key;
            const wasSaved = savedKey === key;
            return (
              <Card key={key} style={{ padding: 'var(--spacing-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>{meta.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{meta.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {meta.type === 'text' ? (
                      <input type="text" value={val} onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))} style={{ ...baseInput, width: '220px' }} />
                    ) : (
                      <>
                        <input type="range" min={meta.min} max={meta.max} step={meta.step} value={parseFloat(val) || meta.min} onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))} style={{ width: '120px', accentColor: 'var(--color-primary)' }} />
                        <input type="number" min={meta.min} max={meta.max} step={meta.step} value={val} onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))} style={{ ...baseInput, width: '80px', textAlign: 'center' }} />
                        {meta.unit && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: '28px' }}>{meta.unit}</span>}
                      </>
                    )}
                    <Button variant={wasSaved ? 'secondary' : 'primary'} size="sm" disabled={!isDirty || isSaving} isLoading={isSaving} onClick={() => save(key)} icon={wasSaved ? <Check size={13} /> : <Save size={13} />}>
                      {wasSaved ? 'Saved' : 'Save'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Section: Integrations ────────────────────────────────────────────────────
const IntegrationsSection: React.FC = () => {
  const items = [
    { name: 'Prometheus', desc: 'Metrics scraping and time-series backend. Configured via PROMETHEUS_URL.', status: 'connected', icon: '📊', docs: 'https://prometheus.io/docs/' },
    { name: 'Google Gemini AI', desc: 'AI root-cause analysis. Requires GEMINI_API_KEY in the backend environment.', status: 'configured', icon: '🤖', docs: 'https://ai.google.dev/' },
    { name: 'SMTP Email', desc: 'Email delivery for verification and password reset. Configured via SMTP_HOST, SMTP_PORT, and SMTP_PASSWORD.', status: 'configured', icon: '✉️', docs: null },
    { name: 'Loki (Logs)', desc: 'Log aggregation backend. Deferred — endpoints return empty arrays until Loki is provisioned.', status: 'deferred', icon: '📋', docs: 'https://grafana.com/oss/loki/' },
    { name: 'Qdrant Vector Store', desc: 'Vector DB for RAG knowledge retrieval. Deferred — RAG pipeline is stubbed pending embedding model setup.', status: 'deferred', icon: '🔍', docs: 'https://qdrant.tech/' },
  ];
  const colors: Record<string, string> = { connected: 'var(--color-status-healthy)', configured: '#60a5fa', deferred: 'var(--color-text-muted)' };
  return (
    <div>
      <SectionTitle icon={<Plug size={18} />} title="Integrations & Data Sources" description="External systems connected to this platform. Credentials are configured via environment variables only and are never editable from the UI." />
      <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <Info size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>To update credentials, edit the <code style={{ backgroundColor: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>.env</code> file and restart the backend service. Secrets are never exposed via this interface.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((it) => (
          <Card key={it.name} style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0, marginTop: '2px' }}>{it.icon}</span>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff', marginBottom: '3px' }}>{it.name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{it.desc}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: colors[it.status] }}>● {it.status.charAt(0).toUpperCase() + it.status.slice(1)}</span>
                {it.docs && <a href={it.docs} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>Docs <ChevronRight size={12} /></a>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Section: Audit ────────────────────────────────────────────────────────────
const AuditSection: React.FC = () => {
  const events = [
    { ts: new Date(Date.now() - 3 * 60000).toISOString(),  actor: 'You', action: 'Opened Settings',                  resource: 'settings' },
    { ts: new Date(Date.now() - 12 * 60000).toISOString(), actor: 'You', action: 'Viewed AI Root-Cause Analysis',    resource: 'incidents' },
    { ts: new Date(Date.now() - 35 * 60000).toISOString(), actor: 'You', action: 'Authenticated (JWT issued)',        resource: 'auth' },
  ];
  return (
    <div>
      <SectionTitle icon={<ClipboardList size={18} />} title="Audit Log" description="Security-relevant actions in this workspace. Full persistent server-side audit logging is planned for a future release." />
      <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <Info size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>Server-side audit persistence is deferred. Entries below reflect your current browser session only.</span>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              {['TIMESTAMP', 'ACTOR', 'ACTION', 'RESOURCE'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{new Date(e.ts).toLocaleTimeString()} · {new Date(e.ts).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px', color: 'var(--color-primary)', fontWeight: 600 }}>{e.actor}</td>
                <td style={{ padding: '12px 16px', color: '#e2e8f0' }}>{e.action}</td>
                <td style={{ padding: '12px 16px' }}><Badge variant="neutral">{e.resource}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// ─── Sidebar nav ───────────────────────────────────────────────────────────────
const NAV: { id: Section; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: 'profile',      label: 'Profile',            icon: <User size={15} /> },
  { id: 'security',     label: 'Security',           icon: <Lock size={15} /> },
  { id: 'users',        label: 'Users & Roles',      icon: <Users size={15} />,       adminOnly: true },
  { id: 'detection',    label: 'Detection Config',   icon: <Sliders size={15} />,     adminOnly: true },
  { id: 'integrations', label: 'Integrations',       icon: <Plug size={15} /> },
  { id: 'audit',        label: 'Audit Log',          icon: <ClipboardList size={15} /> },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export const SettingsPage: React.FC = () => {
  const { isAdmin, refreshUser } = useAuth();
  const [active, setActive] = useState<Section>('profile');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-5)' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>Settings</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Manage your profile, security, workspace configuration, and integrations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--spacing-6)', alignItems: 'start' }}>

        {/* Sidebar */}
        <Card style={{ padding: 'var(--spacing-3)', position: 'sticky', top: '20px' }}>
          {NAV.map((item) => {
            const restricted = item.adminOnly && !isAdmin;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => !restricted && setActive(item.id)}
                disabled={restricted}
                title={restricted ? 'Admin access required' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 12px', borderRadius: 'var(--radius-md)', border: 'none',
                  cursor: restricted ? 'not-allowed' : 'pointer',
                  backgroundColor: isActive ? 'rgba(6,182,212,0.12)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : restricted ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
                  textAlign: 'left', transition: 'all 0.15s ease',
                  opacity: restricted ? 0.45 : 1, marginBottom: '2px',
                }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.adminOnly && <Shield size={11} style={{ flexShrink: 0, opacity: 0.5 }} />}
              </button>
            );
          })}
        </Card>

        {/* Content */}
        <Card style={{ padding: 'var(--spacing-6)', minHeight: '500px' }}>
          {active === 'profile'      && <ProfileSection refreshUser={refreshUser} />}
          {active === 'security'     && <SecuritySection />}
          {active === 'users'        && <UsersSection isAdmin={isAdmin} />}
          {active === 'detection'    && <DetectionSection isAdmin={isAdmin} />}
          {active === 'integrations' && <IntegrationsSection />}
          {active === 'audit'        && <AuditSection />}
        </Card>
      </div>
    </div>
  );
};
