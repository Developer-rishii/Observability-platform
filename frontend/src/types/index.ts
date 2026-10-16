export interface User {
  id: number;
  email: string;
  fullName?: string | null;
  isAdmin: boolean;
  isVerified?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export interface SystemHealth {
  db: boolean;
  prometheus: boolean;
  prometheusTargets: Array<{
    job: string;
    instance: string;
    health: string;
    lastScrape?: string;
  }>;
}

export interface MetricPoint {
  t: string;
  v: number;
}

export interface AnomalyMarker {
  t: string;
  score: number;
}

export interface MetricSeries {
  metric: string;
  label: string;
  unit: string;
  points: MetricPoint[];
  threshold?: number | null;
  anomalies?: AnomalyMarker[] | null;
}

export interface Server {
  id: number;
  hostname: string;
  ipAddress: string;
  osInfo?: string | null;
  status: 'active' | 'degraded' | 'offline';
  uptimeSeconds?: number | null;
  cpuPct?: number | null;
  memPct?: number | null;
  diskPct?: number | null;
  containerCount?: number | null;
}

export interface Container {
  id: string;
  name: string;
  service: string;
  status: 'running' | 'exited' | 'restarting' | 'paused';
  cpuPct?: number | null;
  memMb?: number | null;
  restartCount: number;
  startedAt?: string | null;
}

export type ResourceType = 'virtual-machine' | 'container' | 'k8s-node' | 'database';
export type ResourceHealthStatus = 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';

export interface InfraResource {
  id: string;
  name: string;
  type: ResourceType;
  environment: 'production' | 'staging' | 'development';
  region: string;
  status: ResourceHealthStatus;
  cpuPct: number;
  memPct: number;
  networkThroughputMbps: number;
  lastSeen: string;
  service?: string;
  tags: string[];
  isSampleData?: boolean;
}

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IncidentStatus = 'candidate' | 'open' | 'investigating' | 'resolved';

export interface Incident {
  id: number;
  title: string;
  description?: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  serverId?: number | null;
  affectedService?: string | null;
  metricName: string;
  metricValue: number;
  threshold: number;
  anomalyScore?: number | null;
  detectedAt: string;
  resolvedAt?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  affectedMetrics: string[];
}

export type AlertStatus = 'firing' | 'acknowledged' | 'resolved';

export interface Alert {
  id: number;
  ruleName: string;
  metricName: string;
  threshold: number;
  value?: number | null;
  status: AlertStatus;
  triggeredAt?: string | null;
  incidentId?: number | null;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: '>' | '<' | '>=';
  threshold: number;
  unit: string;
  evaluationWindow: string;
  severity: IncidentSeverity;
  enabled: boolean;
  targetService?: string;
}

export interface Envelope<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface RcaEvidenceItem {
  text: string;
  ref?: { type: string; id: string } | null;
}

export interface RcaAnalysis {
  summary: string;
  probableCause: string;
  confidence: 'low' | 'medium' | 'high';
  supportingEvidence: RcaEvidenceItem[];
  affectedComponents: string[];
  impact: string;
  recommendedInvestigation: string[];
  possibleRemediation: string[];
  alternativeCauses: string[];
  // Backwards-compat
  nextSteps: string[];
  // Metadata (client-side enriched)
  analyzedAt?: string;
}

export interface IncidentDetail extends Incident {
  metricEvidence: MetricSeries[];
  logs: any[];
  events: any[];
  analysis?: RcaAnalysis | null;
}
