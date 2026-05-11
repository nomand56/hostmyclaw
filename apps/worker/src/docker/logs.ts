import { docker } from './client.js';
import { db } from '@hostmyclaw/db';
import { generateId } from '@hostmyclaw/shared';

export async function streamContainerLogs(assistantId: string, containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  const logStream = await container.logs({
    stdout: false,
    stderr: true,
    follow: true,
    timestamps: true,
    tail: 0,
  });

  const { PassThrough } = await import('stream');
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();

  docker.modem.demuxStream(logStream, stdoutStream, stderrStream);

  stderrStream.on('data', async (chunk: Buffer) => {
    const line = chunk.toString('utf8').trim();
    if (!line) return;
    await db('assistant_logs').insert({
      id: generateId('log'),
      assistant_id: assistantId,
      type: 'runtime',
      level: 'error',
      message: line.slice(0, 2000),
      timestamp: new Date(),
    });
  });
}
