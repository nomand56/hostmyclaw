import type { FastifyInstance } from 'fastify';

export async function subscriptionRoute(app: FastifyInstance): Promise<void> {
  app.get('/subscription', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const sub = await app.db('subscriptions').where({ user_id: userId }).first();
    return reply.send({ subscription: sub ?? null });
  });
}
