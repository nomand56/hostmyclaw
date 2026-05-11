import { Worker } from 'bullmq';
import { redis } from '@hostmyclaw/queue';
import type { DeploymentQueuePayload } from '@hostmyclaw/queue';
import { deployAssistant } from '../processors/deployAssistant.js';
import { stopAssistant } from '../processors/stopAssistant.js';

export const deploymentWorker = new Worker<DeploymentQueuePayload>(
  'deployment-queue',
  async (job) => {
    const data = job.data;
    if (data.type === 'deploy') {
      await deployAssistant(data);
    } else if (data.type === 'stop') {
      await stopAssistant(data.assistantId, data.containerName);
    } else if (data.type === 'restart') {
      await stopAssistant(data.assistantId, data.containerName);
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: { max: 10, duration: 10_000 },
  },
);

deploymentWorker.on('failed', (job, err) => {
  console.error(`[deployment-worker] Job ${job?.id} failed:`, err.message);
});
