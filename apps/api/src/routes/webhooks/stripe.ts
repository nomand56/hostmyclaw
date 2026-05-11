import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { getPlanByPriceId } from '@hostmyclaw/shared';
import { generateId } from '@hostmyclaw/shared';

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/stripe', { config: { rawBody: true } }, async (req, reply) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = app.stripe.webhooks.constructEvent(
        (req as unknown as { rawBody: Buffer }).rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return reply.code(400).send('Invalid signature');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0].price.id;
        const plan = getPlanByPriceId(priceId);

        await app.db('subscriptions')
          .insert({
            id: generateId('sub'),
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            plan: plan.name,
            status: sub.status,
            assistant_limit: plan.assistantLimit,
            current_period_start: new Date((sub as unknown as { current_period_start: number }).current_period_start * 1000),
            current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .onConflict('stripe_subscription_id')
          .merge();

        await app.db('users')
          .where({ stripe_customer_id: sub.customer as string })
          .update({ plan: plan.name });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await app.db('subscriptions')
          .where({ stripe_subscription_id: sub.id })
          .update({ status: 'canceled' });
        await app.db('users')
          .where({ stripe_customer_id: sub.customer as string })
          .update({ plan: 'free' });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await app.db('subscriptions')
          .where({ stripe_subscription_id: (invoice as unknown as { subscription: string }).subscription })
          .update({ status: 'past_due' });
        break;
      }
    }

    return reply.send({ received: true });
  });
}
