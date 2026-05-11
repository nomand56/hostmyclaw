import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/requireAuth.js';

export async function meRoute(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.user as { id: string };
    const user = await app.db('users')
      .where({ id })
      .select('id', 'email', 'name', 'plan', 'created_at')
      .first();

    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send({ user });
  });
}
