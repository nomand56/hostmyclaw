import { Worker } from 'bullmq';
import { redis } from '@hostmyclaw/queue';
import { checkAllHealth } from '../processors/checkHealth.js';

export const healthcheckWorker = new Worker(
  'healthcheck-queue',
  async () => {
    await checkAllHealth();
  },
  { connection: redis, concurrency: 1 },
);

healthcheckWorker.on('failed', (job, err) => {
  console.error(`[healthcheck-worker] Job ${job?.id} failed:`, err.message);
});
