import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docker } from './client.js';
import type { DeployJobPayload } from '@hostmyclaw/queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function shouldBuildLocalImage(imageName: string): boolean {
  return imageName === 'openclaw' || imageName === 'openclaw:latest';
}

export function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const statusCode = (error as { statusCode?: number }).statusCode;
  const message = (error as { message?: string }).message ?? '';
  return statusCode === 404 || message.includes('No such image');
}

async function ensureImage(imageName: string): Promise<void> {
  try {
    await docker.getImage(imageName).inspect();
    return;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  if (shouldBuildLocalImage(imageName)) {
    const buildContext = path.resolve(__dirname, '../../../../infra/openclaw');
    const stream = await docker.buildImage(
      { context: buildContext, src: ['Dockerfile', 'openclaw.json'] },
      { t: imageName },
    );

    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()), () => undefined);
    });
    return;
  }

  const pullStream = await docker.pull(imageName);
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(pullStream, (err) => (err ? reject(err) : resolve()), () => undefined);
  });
}

export async function createAndStartContainer(
  job: DeployJobPayload,
  envVars: Record<string, string>,
) {
  // Remove any leftover container with the same name from a previous failed deploy
  await removeContainer(job.containerName);

  const imageName = process.env.OPENCLAW_IMAGE ?? 'openclaw:latest';
  await ensureImage(imageName);

  const domain = process.env.ASSISTANTS_SUBDOMAIN!;
  const container = await docker.createContainer({
    name: job.containerName,
    Image: imageName,
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
