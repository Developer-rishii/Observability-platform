import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Radio, 
  ArrowRight, 
  Activity, 
  Cpu, 
  Sparkles, 
  Server, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  Network, 
  ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LandingPage: React.FC = () => {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);

  const workflowSteps = [
    {
      num: '01',
      title: 'Collect Telemetry',
      badge: 'Sub-second Scrapes',
      desc: 'Native Prometheus scrapers and Node Exporters stream high-resolution metrics from Linux hosts, Docker engines, and service ports.',
      icon: <Activity size={20} color="var(--color-primary)" />,
    },
    {
      num: '02',
      title: 'Detect Behavioral Deviations',
      badge: 'Isolation Forest ML',
      desc: 'Unsupervised ML pipelines evaluate multi-dimensional metric vectors to detect subtle anomalies before hard limits are tripped.',
      icon: <Cpu size={20} color="var(--color-accent)" />,
    },
    {
      num: '03',
      title: 'Correlate Telemetry Evidence',
      badge: 'Time-Windowed Blast Radius',
      desc: 'Auto-correlates multi-service metric spikes, docker daemon crash events, and log bursts across a dynamic 15-minute correlation window.',
      icon: <Network size={20} color="#38bdf8" />,
    },
    {
      num: '04',
      title: 'Investigate with Explainable AI',
      badge: 'Google Gemini Diagnostics',
      desc: 'Synthesizes telemetry evidence, confidence scores, probable root causes, and clear remediation playbooks with zero hallucinations.',
      icon: <Sparkles size={20} color="#f59e0b" />,
    },
    {
      num: '05',
      title: 'Resolve & Transition Incident',
      badge: 'State Machine Governance',
      desc: 'Track workflow lifecycle from Candidate → Open → Investigating → Resolved with strict team-level access control.',
      icon: <CheckCircle2 size={20} color="var(--color-status-healthy)" />,
    },
  ];

  const capabilityItems = [
    {
      icon: <Server size={24} color="var(--color-primary)" />,
      title: 'Infrastructure Fleet Tracking',
      desc: 'Inspect bare metal, virtual machines, and Docker container fleets with live CPU, memory, and disk health indicators.',
    },
    {
      icon: <Activity size={24} color="#38bdf8" />,
      title: 'Multi-Resolution Metric Queries',
      desc: 'Direct query execution against Prometheus engine across 15m, 30m, 1h, 6h, and 24h analytical windows.',
    },
    {
      icon: <Cpu size={24} color="var(--color-accent)" />,
      title: 'Isolation Forest Anomaly Scoring',
      desc: 'Statistical and machine-learning anomaly detectors eliminate noisy alert storms and highlight authentic system drift.',
    },
    {
      icon: <Sparkles size={24} color="#f59e0b" />,
      title: 'Explainable AI Root-Cause Analysis',
      desc: 'Context-enriched diagnostics deliver actionable next steps and root causes without fabricating unsupported claims.',
    },
    {
      icon: <FileText size={24} color="#ec4899" />,
      title: 'Centralized Log Aggregation',
      desc: 'Live stdout/stderr stream inspection with severity-level filtering and regex search for instant error isolation.',
    },
    {
      icon: <ShieldCheck size={24} color="var(--color-status-healthy)" />,
      title: 'Role-Based Access Governance',
      desc: 'Granular permissions differentiating Super Admin, SRE, and Developer roles with server-side authorization enforcement.',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-base)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        overflowX: 'hidden',
      }}
    >
      {/* 1. STICKY NAVBAR */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 40px',
          borderBottom: '1px solid var(--color-border-subtle)',
          backgroundColor: 'rgba(7, 11, 18, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 60,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
            AetherPulse
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(6, 182, 212, 0.12)',
              color: 'var(--color-primary)',
              fontWeight: 600,
              border: '1px solid rgba(6, 182, 212, 0.25)',
              display: 'inline-block',
              marginLeft: '4px',
            }}
          >
            v1.0
          </span>
        </div>

        {/* Desktop Nav Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <a href="#features" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Features
          </a>
          <a href="#workflow" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Detection Workflow
          </a>
          <a href="#preview" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Console Preview
          </a>
          <a href="#integrations" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Integrations
          </a>
          <a href="#security" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Enterprise Security
          </a>
        </nav>

        {/* Auth CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm" icon={<ArrowRight size={14} />}>
              Launch Console
            </Button>
          </Link>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section
        style={{
          padding: '90px 24px 60px',
          textAlign: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* Futuristic Ambient Glow Backgrounds */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '700px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, rgba(139, 92, 246, 0.10) 45%, transparent 75%)',
            filter: 'blur(70px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              color: 'var(--color-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              marginBottom: '28px',
              boxShadow: 'var(--shadow-glow-cyan)',
            }}
          >
            <Sparkles size={14} />
            Autonomous Incident Diagnostics & Multi-Node Telemetry
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.75rem, 5.5vw, 4.5rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.035em',
              margin: '0 auto 24px auto',
              maxWidth: '960px',
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 65%, #64748b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Autonomous Cloud Observability with Explainable AI
          </h1>

          <p
            style={{
              fontSize: '1.1875rem',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              maxWidth: '720px',
              margin: '0 auto 40px auto',
            }}
          >
            Continuous Prometheus scraping, unsupervised Isolation Forest anomaly detection, and explainable root-cause intelligence engineered for cloud infrastructure teams.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '60px' }}>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg" icon={<ArrowRight size={18} />}>
                Launch Live Console
              </Button>
            </Link>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="lg" icon={<ExternalLink size={16} />}>
                FastAPI Swagger Spec
              </Button>
            </a>
          </div>

          {/* Interactive Simulated Console Showcase */}
          <div
            id="preview"
            style={{
              maxWidth: '1060px',
              margin: '0 auto',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-bg-elevated)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), var(--shadow-glow-cyan)',
              overflow: 'hidden',
              textAlign: 'left',
            }}
          >
            {/* Window titlebar */}
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--color-border-subtle)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  aetherpulse.internal // live-telemetry-feed: cpu.cluster.prod
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-status-healthy)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-status-healthy)' }} />
                <span>TELEMETRY STREAM ACTIVE</span>
              </div>
            </div>

            {/* Window Mock Content */}
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', backgroundColor: 'var(--color-bg-base)' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Fleet Nodes</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>1 Host (Healthy)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '8px' }}>Prometheus Target: Scrape interval 15s</div>
              </div>

              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Anomaly Score (Isolation Forest)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>0.924 Score</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-status-warning)', marginTop: '8px' }}>Peak breached 80% threshold</div>
              </div>

              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: 'var(--shadow-glow-violet)' }}>
                <div style={{ fontSize: '0.75rem', color: '#a78bfa', textTransform: 'uppercase', fontWeight: 600 }}>AI Root-Cause Diagnostics</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>High CPU Contention</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '6px' }}>Correlated: work-generator worker task burst</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CAPABILITIES GRID */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: '1160px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>
            Built for Resilient Cloud Architecture
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
            Everything Needed for Unified Cloud Observability
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {capabilityItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '28px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-subtle)',
                transition: 'border-color var(--transition-normal), transform var(--transition-normal)',
              }}
            >
              <div style={{ marginBottom: '16px' }}>{item.icon}</div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#ffffff', margin: '0 0 10px 0' }}>{item.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. WORKFLOW PIPELINE INTERACTIVE SECTION */}
      <section id="workflow" style={{ padding: '80px 24px', backgroundColor: 'var(--color-bg-elevated)', borderTop: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>
              End-To-End Observability Pipeline
            </div>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              From Sub-Second Scrapes to Autonomous Resolution
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {workflowSteps.map((step, idx) => {
              const isSelected = activeWorkflowStep === idx;
              return (
                <div
                  key={step.num}
                  onClick={() => setActiveWorkflowStep(idx)}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'var(--color-bg-surface)',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                      {step.num}
                    </span>
                    {step.icon}
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff' }}>
                    {step.title}
                  </h4>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '8px' }}>
                    {step.badge}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. VERIFIED INTEGRATIONS SECTION */}
      <section id="integrations" style={{ padding: '80px 24px', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>
          Open-Standard Ecosystem
        </div>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
          Native Integration with Your Cloud Toolchain
        </h2>
        <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', maxWidth: '600px', margin: '0 auto 40px auto' }}>
          Connects natively to Prometheus exporters, Docker APIs, PostgreSQL storage, and Google Gemini with standard zero-lock-in protocols.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {['Prometheus 2.x', 'Docker Engine API', 'PostgreSQL 15', 'Qdrant Vector DB', 'Google Gemini 1.5', 'FastAPI Pydantic v2'].map((tech) => (
            <div
              key={tech}
              style={{
                padding: '12px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={15} color="var(--color-primary)" />
              {tech}
            </div>
          ))}
        </div>
      </section>

      {/* 6. ENTERPRISE READINESS & ACCESS GOVERNANCE */}
      <section id="security" style={{ padding: '80px 24px', backgroundColor: 'var(--color-bg-elevated)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>
              Security & RBAC
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
              Enterprise Access Governance
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Role-based authorization is enforced strictly on the backend with JSON Web Tokens and bcrypt password hashing. Client sessions are verified against authoritative API servers.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                <ShieldCheck size={16} color="var(--color-status-healthy)" />
                JWT Auth with Authoritative Server Verification
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                <ShieldCheck size={16} color="var(--color-status-healthy)" />
                Isolation Forest Multi-Feature Threshold Tuning
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                <ShieldCheck size={16} color="var(--color-status-healthy)" />
                Explicit LLM Guardrails & Graceful 503 Fallback
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
              auth_authoritative_contract.json
            </div>
            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-primary)', lineHeight: 1.5, overflowX: 'auto' }}>
{`{
  "user": {
    "email": "admin@example.com",
    "isAdmin": true,
    "role": "Super Admin"
  },
  "permissions": [
    "metrics:read",
    "incidents:mutate_status",
    "ai_rca:execute",
    "thresholds:configure"
  ]
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA BANNER */}
      <section style={{ padding: '90px 24px', textAlign: 'center' }}>
        <div
          style={{
            maxWidth: '880px',
            margin: '0 auto',
            padding: '50px 32px',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            boxShadow: 'var(--shadow-glow-cyan)',
          }}
        >
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
            Ready to Accelerate Incident Investigation?
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', maxWidth: '580px', margin: '0 auto 32px auto', lineHeight: 1.6 }}>
            Launch the AetherPulse observability console and correlate telemetry alerts across your infrastructure fleet in real time.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg" icon={<ArrowRight size={18} />}>
                Sign In to Console
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--color-border-subtle)',
          padding: '36px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '0.8125rem',
          color: 'var(--color-text-muted)',
          backgroundColor: 'var(--color-bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={16} color="var(--color-primary)" />
          <span style={{ color: '#ffffff', fontWeight: 600 }}>AetherPulse Cloud Observability</span>
          <span>© 2026. All rights reserved.</span>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Link to="/login" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Console Login</Link>
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>API Docs</a>
          <a href="http://localhost:9090" target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Prometheus UI</a>
        </div>
      </footer>
    </div>
  );
};
