import type { FastifyInstance } from 'fastify';
import { PLANS, AppError } from '@hostmyclaw/shared';
import { z } from 'zod';

const schema = z.object({ planId: z.enum(['starter', 'growth', 'pro']) });

export async function checkoutRoute(app: FastifyInstance): Promise<void> {
  app.post('/checkout', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { planId } = schema.parse(req.body);
    const plan = PLANS[planId];

    const user = await app.db('users').where({ id: userId }).first();
    if (!user) return reply.code(404).send({ error: 'User not found' });

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await app.stripe.customers.create({ email: user.email, name: user.name });
      customerId = customer.id;
      await app.db('users').where({ id: userId }).update({ stripe_customer_id: customerId });
    }

    const session = await app.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId!, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { userId },
    });

    return reply.send({ checkoutUrl: session.url });
  });
}
