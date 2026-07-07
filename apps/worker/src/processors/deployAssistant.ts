import { db } from '@hostmyclaw/db';
import { generateId } from '@hostmyclaw/shared';
import { createAndStartContainer } from '../docker/containers.js';
import { buildEnvVars } from '../lib/envBuilder.js';
import { releasePort } from '../lib/portAllocator.js';
import type { DeployJobPayload } from '@hostmyclaw/queue';

async function logDeploy(assistantId: string, jobId: string, level: string, message: string) {
  await db('assistant_logs').insert({
    id: generateId('log'),
    assistant_id: assistantId,
    job_id: jobId,
    type: 'deployment',
    level,
    message,
    timestamp: new Date(),
  });
}

export async function deployAssistant(job: DeployJobPayload): Promise<void> {
  const { assistantId, jobId } = job;

  await db('deployment_jobs').where({ id: jobId }).update({ status: 'processing', started_at: new Date() });
  await db('assistants').where({ id: assistantId }).update({ status: 'creating', updated_at: new Date() });
  await logDeploy(assistantId, jobId, 'info', 'Starting deployment');

  try {

    const envVars = await buildEnvVars(job);
    await logDeploy(assistantId, jobId, 'info', 'Pulling image and building env vars');

    const container = await createAndStartContainer(job, envVars);
    const info = await container.inspect();
    const containerId = info.Id;

    await logDeploy(assistantId, jobId, 'info', 'Container started, waiting for health check');

    await pollHealth(job.port, 60_000);

    await db('assistants').where({ id: assistantId }).update({
      status: 'running',
      container_id: containerId,
      uptime_since: new Date(),
      error_message: null,
      deployed_at: new Date(),
      updated_at: new Date(),
    });

    
    await db('deployment_jobs').where({ id: jobId }).update({ status: 'completed', finished_at: new Date() });
    await db('port_pool').where({ port: job.port }).update({ assistant_id: assistantId });
    await logDeploy(assistantId, jobId, 'info', 'Deployment successful');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db('assistants').where({ id: assistantId }).update({
      status: 'failed',
      error_message: message,
      updated_at: new Date(),
    });
    await db('deployment_jobs').where({ id: jobId }).update({
      status: 'failed',
      finished_at: new Date(),
      error: message,
    });
    await releasePort(job.port);
    await logDeploy(assistantId, jobId, 'error', message);
    throw err;
  }
}

async function pollHealth(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/healthz`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Health check timed out after 60s');
}
