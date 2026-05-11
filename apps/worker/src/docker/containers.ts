import { docker } from './client.js';
import type { DeployJobPayload } from '@hostmyclaw/queue';

export async function createAndStartContainer(
  job: DeployJobPayload,
  envVars: Record<string, string>,
) {
  const domain = process.env.ASSISTANTS_SUBDOMAIN!;
  const container = await docker.createContainer({
    name: job.containerName,
    Image: process.env.OPENCLAW_IMAGE ?? 'openclaw:latest',
    Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
    Labels: {
      'traefik.enable': 'true',
      [`traefik.http.routers.${job.containerName}.rule`]: `Host(\`${job.subdomain}.${domain}\`)`,
      [`traefik.http.routers.${job.containerName}.tls`]: 'true',
      [`traefik.http.routers.${job.containerName}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.services.${job.containerName}.loadbalancer.server.port`]: '18789',
      'com.hostmyclaw.assistant-id': job.assistantId,
      'com.hostmyclaw.user-id': job.userId,
    },
    ExposedPorts: { '18789/tcp': {} },
    HostConfig: {
      NetworkMode: process.env.OPENCLAW_NETWORK ?? 'assistants-net',
      PortBindings: { '18789/tcp': [{ HostPort: String(job.port) }] },
      RestartPolicy: { Name: 'on-failure', MaximumRetryCount: 3 },
      Memory: 512 * 1024 * 1024,
      CpuPeriod: 100_000,
      CpuQuota: 50_000,
    },
  });

  await container.start();
  return container;
}

export async function stopContainer(containerName: string): Promise<void> {
  try {
    const container = docker.getContainer(containerName);
    await container.stop({ t: 10 });
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode !== 404) throw err;
  }
}

export async function removeContainer(containerName: string): Promise<void> {
  try {
    const container = docker.getContainer(containerName);
    await container.remove({ force: true });
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode !== 404) throw err;
  }
}
