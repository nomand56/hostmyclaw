import { deploymentWorker } from './workers/deployment.worker.js';
import { teardownWorker } from './workers/teardown.worker.js';
import { healthcheckWorker } from './workers/healthcheck.worker.js';
import { healthQueue } from '@hostmyclaw/queue';

console.log('[worker] Starting all workers...');

healthQueue.add(
  'poll-all-assistants',
  {},
  {
    repeat: { every: 30_000 },
    jobId: 'health-poll-singleton',
  },
);

process.on('SIGTERM', async () => {
  console.log('[worker] Shutting down...');
  await Promise.all([
    deploymentWorker.close(),
    teardownWorker.close(),
    healthcheckWorker.close(),
  ]);
  process.exit(0);
});
