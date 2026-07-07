import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { getPlanByPriceId } from '@hostmyclaw/shared';
import { generateId } from '@hostmyclaw/shared';

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  async function syncSubscriptionFromStripe(subscriptionId: string, customerId: string): Promise<void> {
    const stripeSubscription = await app.stripe.subscriptions.retrieve(subscriptionId);
    const priceId = stripeSubscription.items.data[0].price.id;
    const plan = getPlanByPriceId(priceId);
    const user = await app.db('users').where({ stripe_customer_id: customerId }).first();

    if (!user) {
      return;
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
        id: generateId('sub'),
        user_id: user.id,
        ...payload,
      });
    }

    await app.db('users').where({ id: user.id }).update({ plan: plan.name });
  }

  // Parse body as raw buffer for this scope only so Stripe signature verification works
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  app.post('/stripe', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = app.stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return reply.code(400).send('Invalid signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        if (!customerId || !subscriptionId) {
          break;
        }

        await syncSubscriptionFromStripe(subscriptionId, customerId);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(sub.id, sub.customer as string);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const user = await app.db('users').where({ stripe_customer_id: sub.customer as string }).first();

        if (!user) {
          break;
        }

        await app.db('subscriptions').where({ user_id: user.id }).update({ status: 'canceled' });
        await app.db('users').where({ id: user.id }).update({ plan: 'free' });
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
