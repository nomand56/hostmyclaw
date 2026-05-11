import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/requireAuth.js';
import { generateId } from '@hostmyclaw/shared';
import { z } from 'zod';
import { deployRoute } from './deploy.js';
import { statusRoute } from './status.js';
import { logsRoute } from './logs.js';
import { assistantByIdRoute } from './[id].js';

const createSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().optional(),
  skills: z.array(z.string()).default([]),
  config: z.record(z.unknown()).default({}),
});

export async function assistantRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req) => {
    const { id: userId } = req.user as { id: string };
    const assistants = await app.db('assistants').where({ user_id: userId }).orderBy('created_at', 'desc');
    return { assistants };
  });

  app.post('/', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const body = createSchema.parse(req.body);

    const [assistant] = await app.db('assistants')
      .insert({
        id: generateId('asst'),
        user_id: userId,
        name: body.name,
        template_id: body.templateId ?? null,
        config: JSON.stringify(body.config),
        status: 'draft',
      })
      .returning('*');

    return reply.code(201).send(assistant);
  });

  await app.register(assistantByIdRoute);
  await app.register(deployRoute);
  await app.register(statusRoute);
  await app.register(logsRoute);
}
