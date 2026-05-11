import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@hostmyclaw/shared';

export async function assertCanDeploy(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = (req.user as { id: string }).id;
  const db = req.server.db;

  const [sub, runningRow] = await Promise.all([
    db('subscriptions').where({ user_id: userId }).first(),
    db('assistants').where({ user_id: userId, status: 'running' }).count('id as count').first(),
  ]);

  if (!sub || sub.status !== 'active') {
    throw new AppError('SUBSCRIPTION_REQUIRED', 'An active subscription is required to deploy', 403);
  }

  if (Number(runningRow?.count ?? 0) >= sub.assistant_limit) {
    throw new AppError(
      'LIMIT_EXCEEDED',
      `Your ${sub.plan} plan allows ${sub.assistant_limit} running assistant(s)`,
      403,
    );
  }
}
