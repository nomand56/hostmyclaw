import fp from 'fastify-plugin';
import { db } from '@hostmyclaw/db';
import type { FastifyInstance } from 'fastify';

export const dbPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    await db.destroy();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db;
  }
}
