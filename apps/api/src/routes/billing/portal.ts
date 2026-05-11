import type { FastifyInstance } from 'fastify';
import { AppError } from '@hostmyclaw/shared';

export async function portalRoute(app: FastifyInstance): Promise<void> {
  app.post('/portal', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const user = await app.db('users').where({ id: userId }).first();

    if (!user?.stripe_customer_id) {
      throw new AppError('NO_CUSTOMER', 'No billing account found', 404);
    }

    const session = await app.stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
    });

    return reply.send({ portalUrl: session.url });
  });
}
