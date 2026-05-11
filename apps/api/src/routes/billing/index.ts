import type { FastifyInstance } from 'fastify';
import { checkoutRoute } from './checkout.js';
import { subscriptionRoute } from './subscription.js';
import { portalRoute } from './portal.js';
import { requireAuth } from '../../middleware/requireAuth.js';

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  await app.register(checkoutRoute);
  await app.register(subscriptionRoute);
  await app.register(portalRoute);
}
