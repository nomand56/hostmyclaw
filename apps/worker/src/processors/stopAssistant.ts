import { db } from '@hostmyclaw/db';
import { stopContainer } from '../docker/containers.js';
import { releasePort } from '../lib/portAllocator.js';

export async function stopAssistant(assistantId: string, containerName: string): Promise<void> {
  await stopContainer(containerName);

  const assistant = await db('assistants').where({ id: assistantId }).first();
  if (assistant?.container_port) {
    await releasePort(assistant.container_port);
  }

  await db('assistants').where({ id: assistantId }).update({
    status: 'stopped',
    container_port: null,
    health_status: 'unknown',
    updated_at: new Date(),
  });
}
