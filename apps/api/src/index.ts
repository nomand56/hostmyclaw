import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { dbPlugin } from './plugins/db.js';
import { authPlugin } from './plugins/auth.js';
import { stripePlugin } from './plugins/stripe.js';

import { authRoutes } from './routes/auth/index.js';
import { assistantRoutes } from './routes/assistants/index.js';
import { billingRoutes } from './routes/billing/index.js';
import { templateRoutes } from './routes/templates.js';
import { skillRoutes } from './routes/skills.js';
import { stripeWebhookRoutes } from './routes/webhooks/stripe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

app.setErrorHandler((error, _req, reply) => {
  const statusCode = error.statusCode ?? 500;
  reply.code(statusCode).send({
    error: error.message,
    code: (error as unknown as { code?: string }).code,
  });
});

await app.register(cors, { origin: process.env.FRONTEND_URL ?? '*' });

await app.register(swagger, {
  mode: 'static',
  specification: {
    path: join(__dirname, '../swagger.yaml'),
    postProcessor: (spec) => spec,
    baseDir: join(__dirname, '..'),
  },
});

await app.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true },
  staticCSP: true,
});

await app.register(dbPlugin);
await app.register(authPlugin);
await app.register(stripePlugin);

await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(assistantRoutes, { prefix: '/api/v1/assistants' });
await app.register(billingRoutes, { prefix: '/api/v1/billing' });
await app.register(templateRoutes, { prefix: '/api/v1/templates' });
await app.register(skillRoutes, { prefix: '/api/v1/skills' });
await app.register(stripeWebhookRoutes, { prefix: '/api/v1/webhooks' });

app.get('/health', async () => ({ status: 'ok' }));

try {
  await app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
