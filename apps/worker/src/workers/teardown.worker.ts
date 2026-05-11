import { Worker } from 'bullmq';
import { redis } from '@hostmyclaw/queue';
import type { TeardownQueuePayload } from '@hostmyclaw/queue';
import { stopContainer, removeContainer } from '../docker/containers.js';
import { releasePort } from '../lib/portAllocator.js';
import { db } from '@hostmyclaw/db';

export const teardownWorker = new Worker<TeardownQueuePayload>(
  'teardown-queue',
  async (job) => {
    const { assistantId, containerName, port } = job.data;
    await stopContainer(containerName);
    await removeContainer(containerName);
    await releasePort(port);
    await db('assistants').where({ id: assistantId }).update({
      status: 'stopped',
      container_name: null,
      container_id: null,
      container_port: null,
      health_status: 'unknown',
      updated_at: new Date(),
    });
  },
  { connection: redis, concurrency: 3 },
);

teardownWorker.on('failed', (job, err) => {
  console.error(`[teardown-worker] Job ${job?.id} failed:`, err.message);
});
