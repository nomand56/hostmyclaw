import type { FastifyInstance } from 'fastify';
import { getPlanByPriceId } from '@hostmyclaw/shared';

export async function successRoute(app: FastifyInstance): Promise<void> {
  app.post('/checkout/success', async (req, reply) => {
    const { session_id } = req.body as { session_id?: string };

    if (!session_id) {
      return reply.code(400).send({ error: 'Missing session_id' });
    }

    try {
      const session = await app.stripe.checkout.sessions.retrieve(session_id);
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

      if (!customerId || !subscriptionId) {
        return reply.code(400).send({ error: 'Checkout session missing subscription' });
      }

      const stripeSubscription = await app.stripe.subscriptions.retrieve(subscriptionId);
      const priceId = stripeSubscription.items.data[0].price.id;
      const plan = getPlanByPriceId(priceId);
      const user = await app.db('users').where({ stripe_customer_id: customerId }).first();

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const payload = {
        stripe_subscription_id: stripeSubscription.id,
        stripe_price_id: priceId,
        plan: plan.name,
        status: stripeSubscription.status,
        assistant_limit: plan.assistantLimit,
        current_period_start: new Date((stripeSubscription as unknown as { current_period_start: number }).current_period_start * 1000),
        current_period_end: new Date((stripeSubscription as unknown as { current_period_end: number }).current_period_end * 1000),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      };

      const existingSubscription = await app.db('subscriptions').where({ user_id: user.id }).first();

      if (existingSubscription) {
        await app.db('subscriptions').where({ id: existingSubscription.id }).update(payload);
      } else {
        await app.db('subscriptions').insert({
          id: `${Date.now()}`,
          user_id: user.id,
          ...payload,
        });
      }

      await app.db('users').where({ id: user.id }).update({ plan: plan.name });
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : 'Failed to sync checkout' });
    }

    return reply.send({ success: true });
  });
}
