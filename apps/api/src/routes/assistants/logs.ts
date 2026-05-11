import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const querySchema = z.object({
  type: z.enum(['deployment', 'runtime', 'health']).optional(),
  limit: z.coerce.number().max(200).default(50),
  cursor: z.string().optional(),
});

export async function logsRoute(app: FastifyInstance): Promise<void> {
  app.get('/:id/logs', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };
    const query = querySchema.parse(req.query);

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first('id');
    if (!assistant) return reply.code(404).send({ error: 'Not found' });

    let q = app.db('assistant_logs').where({ assistant_id: id }).orderBy('timestamp', 'desc').limit(query.limit);

    if (query.type) q = q.where({ type: query.type });
    if (query.cursor) q = q.where('timestamp', '<', query.cursor);

    const logs = await q;
    const nextCursor = logs.length === query.limit ? logs[logs.length - 1].timestamp : null;

    return reply.send({ logs, nextCursor });
  });
}
