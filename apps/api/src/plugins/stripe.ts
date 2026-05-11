import fp from 'fastify-plugin';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';

export const stripePlugin = fp(async (app: FastifyInstance) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
  app.decorate('stripe', stripe);
});

declare module 'fastify' {
  interface FastifyInstance {
    stripe: Stripe;
  }
}
