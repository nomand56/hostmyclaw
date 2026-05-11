import type { FastifyInstance } from 'fastify';

export async function statusRoute(app: FastifyInstance): Promise<void> {
  app.get('/:id/status', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant) return reply.code(404).send({ error: 'Not found' });

    const job = await app.db('deployment_jobs')
      .where({ assistant_id: id })
      .orderBy('created_at', 'desc')
      .first();

    return reply.send({
      assistantId: id,
      status: assistant.status,
      containerName: assistant.container_name,
      containerPort: assistant.container_port,
      url: assistant.subdomain
        ? `https://${assistant.subdomain}.${process.env.ASSISTANTS_SUBDOMAIN}`
        : null,
      lastHealthCheck: assistant.last_health_at,
      healthStatus: assistant.health_status,
      uptimeSince: assistant.uptime_since,
      deploymentJobId: job?.id ?? null,
      error: assistant.error_message,
    });
  });

  app.get('/:id/health', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant || !assistant.container_port) {
      return reply.code(404).send({ error: 'Not found or not running' });
    }

    try {
      const res = await fetch(`http://localhost:${assistant.container_port}/healthz`, {
        signal: AbortSignal.timeout(5000),
      });
      const body = await res.json();
      return reply.code(res.status).send(body);
    } catch {
      return reply.code(503).send({ status: 'unreachable' });
    }
  });
}
