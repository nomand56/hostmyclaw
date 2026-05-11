import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { teardownQueue } from '@hostmyclaw/queue';
import { generateId } from '@hostmyclaw/shared';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
});

export async function assistantByIdRoute(app: FastifyInstance): Promise<void> {
  app.get('/:id', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant) return reply.code(404).send({ error: 'Not found' });
    return reply.send(assistant);
  });

  app.patch('/:id', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };
    const body = patchSchema.parse(req.body);

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant) return reply.code(404).send({ error: 'Not found' });

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.name) updates.name = body.name;
    if (body.config) updates.config = JSON.stringify(body.config);

    const [updated] = await app.db('assistants').where({ id }).update(updates).returning('*');
    return reply.send(updated);
  });

  app.delete('/:id', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant) return reply.code(404).send({ error: 'Not found' });

    if (assistant.container_name) {
      await teardownQueue.add('teardown', {
        type: 'teardown',
        assistantId: id,
        containerName: assistant.container_name,
        port: assistant.container_port,
      });
    }

    await app.db('assistants').where({ id }).delete();
    return reply.code(204).send();
  });
}
