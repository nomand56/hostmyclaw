export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  stripe_customer_id: string | null;
  plan: string;
  created_at: Date;
  updated_at: Date;
}

export interface Assistant {
  id: string;
  user_id: string;
  name: string;
  template_id: string | null;
  status: 'draft' | 'queued' | 'creating' | 'running' | 'stopping' | 'stopped' | 'failed';
  config: Record<string, unknown>;
  container_name: string | null;
  container_id: string | null;
  container_port: number | null;
  subdomain: string | null;
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  last_health_at: Date | null;
  uptime_since: Date | null;
  error_message: string | null;
  deployed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  config_defaults: Record<string, unknown>;
  openclaw_config: Record<string, unknown>;
  required_skill_ids: string[];
  recommended_skill_ids: string[];
  is_active: boolean;
  created_at: Date;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  config_schema: Array<{ key: string; label: string; type: string; required: boolean }>;
  openclaw_skill_name: string;
  is_active: boolean;
  created_at: Date;
}

export interface AssistantSkill {
  id: string;
  assistant_id: string;
  skill_id: string;
  config: Record<string, unknown>;
  created_at: Date;
}

export interface AssistantSecret {
  id: string;
  assistant_id: string;
  skill_id: string | null;
  key: string;
  value_enc: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentJob {
  id: string;
  assistant_id: string;
  user_id: string;
  type: 'deploy' | 'stop' | 'restart' | 'teardown';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queue_job_id: string | null;
  attempt: number;
  max_attempts: number;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
  created_at: Date;
}

export interface AssistantLog {
  id: string;
  assistant_id: string;
  job_id: string | null;
  type: 'deployment' | 'runtime' | 'health';
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  assistant_limit: number;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PortPool {
  port: number;
  assistant_id: string | null;
  allocated_at: Date | null;
  server_host: string;
}
