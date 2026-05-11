import type { FastifyInstance } from 'fastify';

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_, reply) => {
    const skills = await app.db('skills').where({ is_active: true });
    return reply.send({ skills });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const skill = await app.db('skills').where({ id, is_active: true }).first();
    if (!skill) return reply.code(404).send({ error: 'Not found' });
    return reply.send(skill);
  });
}
