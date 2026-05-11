import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function loginRoute(app: FastifyInstance): Promise<void> {
  app.post('/login', async (req, reply) => {
    const body = schema.parse(req.body);
    const db = app.db;

    const user = await db('users').where({ email: body.email }).first();
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const accessToken = app.jwt.sign({ id: user.id, email: user.email });

    return reply.send({ accessToken, expiresIn: 900 });
  });
}
