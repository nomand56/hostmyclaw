import { Queue } from 'bullmq';
import { redis } from './redis.js';
import type { DeploymentQueuePayload, TeardownQueuePayload } from './types.js';

export const deploymentQueue = new Queue<DeploymentQueuePayload>('deployment-queue', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const teardownQueue = new Queue<TeardownQueuePayload>('teardown-queue', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

export const healthQueue = new Queue('healthcheck-queue', {
  connection: redis,
});
