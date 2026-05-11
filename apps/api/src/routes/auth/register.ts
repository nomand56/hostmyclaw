import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { generateId } from '@hostmyclaw/shared';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export async function registerRoute(app: FastifyInstance): Promise<void> {
  app.post('/register', async (req, reply) => {
    const body = schema.parse(req.body);
    const db = app.db;

    const existing = await db('users').where({ email: body.email }).first();
    if (existing) {
      return reply.code(409).send({ error: 'Email already in use' });
    }

    const password_hash = await bcrypt.hash(body.password, 12);
    const id = generateId('usr');

    const [user] = await db('users')
      .insert({ id, email: body.email, password_hash, name: body.name })
      .returning(['id', 'email', 'name', 'created_at']);

    await db('subscriptions').insert({
      id: generateId('sub'),
      user_id: id,
      plan: 'free',
      status: 'active',
      assistant_limit: 0,
    });

    const accessToken = app.jwt.sign({ id: user.id, email: user.email });

    return reply.code(201).send({ user, accessToken });
  });
}
