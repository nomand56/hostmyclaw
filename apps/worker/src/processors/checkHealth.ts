import { db } from '@hostmyclaw/db';
import { generateId } from '@hostmyclaw/shared';

const failureCounts = new Map<string, number>();

export async function checkAllHealth(): Promise<void> {
  const running = await db('assistants').where({ status: 'running' });

  await Promise.allSettled(running.map((a) => checkOne(a)));
}

async function checkOne(assistant: { id: string; container_port: number }): Promise<void> {
  try {
    const res = await fetch(`http://localhost:${assistant.container_port}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json();

    failureCounts.set(assistant.id, 0);

    await db('assistants').where({ id: assistant.id }).update({
      health_status: res.ok ? 'healthy' : 'unhealthy',
      last_health_at: new Date(),
    });

    await db('assistant_logs').insert({
      id: generateId('log'),
      assistant_id: assistant.id,
      type: 'health',
      level: 'info',
      message: JSON.stringify(body).slice(0, 500),
      timestamp: new Date(),
    });
  } catch (err) {
    const failures = (failureCounts.get(assistant.id) ?? 0) + 1;
    failureCounts.set(assistant.id, failures);

    if (failures >= 3) {
      await db('assistants').where({ id: assistant.id }).update({
        status: 'failed',
        health_status: 'unhealthy',
        error_message: 'Health check failed 3 consecutive times',
        updated_at: new Date(),
      });
      failureCounts.delete(assistant.id);

      await db('assistant_logs').insert({
        id: generateId('log'),
        assistant_id: assistant.id,
        type: 'health',
        level: 'error',
        message: 'Health check failed 3 consecutive times — marking failed',
        timestamp: new Date(),
      });
    }
  }
}
