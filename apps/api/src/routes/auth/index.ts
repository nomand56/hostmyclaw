import type { FastifyInstance } from 'fastify';
import { registerRoute } from './register.js';
import { loginRoute } from './login.js';
import { meRoute } from './me.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.register(meRoute);
}
