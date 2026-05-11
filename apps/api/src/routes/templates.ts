import type { FastifyInstance } from 'fastify';

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_, reply) => {
    const templates = await app.db('templates').where({ is_active: true });
    return reply.send({ templates });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await app.db('templates').where({ id, is_active: true }).first();
    if (!template) return reply.code(404).send({ error: 'Not found' });
    return reply.send(template);
  });
}
