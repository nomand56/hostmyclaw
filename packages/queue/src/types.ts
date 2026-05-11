export interface DeployJobPayload {
  jobId: string;
  type: 'deploy';
  assistantId: string;
  userId: string;
  containerName: string;
  subdomain: string;
  port: number;
  templateId: string;
  skills: string[];
  openclawConfig: Record<string, unknown>;
}

export interface TeardownJobPayload {
  type: 'teardown';
  assistantId: string;
  containerName: string;
  port: number;
}

export interface StopJobPayload {
  type: 'stop';
  assistantId: string;
  containerName: string;
}

export interface RestartJobPayload {
  type: 'restart';
  assistantId: string;
  containerName: string;
  port: number;
}

export type DeploymentQueuePayload = DeployJobPayload | StopJobPayload | RestartJobPayload;
export type TeardownQueuePayload = TeardownJobPayload;
