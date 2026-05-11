import type { FastifyInstance } from 'fastify';
import { deploymentQueue } from '@hostmyclaw/queue';
import { generateId, AppError } from '@hostmyclaw/shared';
import { assertCanDeploy } from '../../middleware/requireSubscription.js';

export async function deployRoute(app: FastifyInstance): Promise<void> {
  app.post('/:id/deploy', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant) return reply.code(404).send({ error: 'Not found' });

    if (!['draft', 'stopped', 'failed'].includes(assistant.status)) {
      throw new AppError('INVALID_STATE', `Cannot deploy assistant in status: ${assistant.status}`, 400);
    }

    await assertCanDeploy(req, reply);

    const portRow = await app.db('port_pool')
      .where({ assistant_id: null })
      .forUpdate()
      .skipLocked()
      .first('port');

    if (!portRow) throw new AppError('NO_PORTS', 'No ports available', 503);

    const containerName = `openclaw_${id.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
    const subdomain = id.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const jobId = generateId('job');

    await app.db.transaction(async (trx) => {
      await trx('port_pool').where({ port: portRow.port }).update({
        assistant_id: id,
        allocated_at: new Date(),
      });
      await trx('assistants').where({ id }).update({
        status: 'queued',
        container_name: containerName,
        container_port: portRow.port,
        subdomain,
        updated_at: new Date(),
      });
      await trx('deployment_jobs').insert({
        id: jobId,
        assistant_id: id,
        user_id: userId,
        type: 'deploy',
        status: 'queued',
      });
    });

    const template = assistant.template_id
      ? await app.db('templates').where({ id: assistant.template_id }).first()
      : null;

    const skills = await app.db('assistant_skills')
      .join('skills', 'assistant_skills.skill_id', 'skills.id')
      .where({ 'assistant_skills.assistant_id': id })
      .select('skills.openclaw_skill_name');

    const bullJob = await deploymentQueue.add('deploy', {
      jobId,
      type: 'deploy',
      assistantId: id,
      userId,
      containerName,
      subdomain,
      port: portRow.port,
      templateId: assistant.template_id ?? '',
      skills: skills.map((s: { openclaw_skill_name: string }) => s.openclaw_skill_name),
      openclawConfig: template?.openclaw_config ?? {},
    });

    await app.db('deployment_jobs').where({ id: jobId }).update({ queue_job_id: bullJob.id });

    return reply.code(202).send({ jobId, assistantId: id, status: 'queued' });
  });

  app.post('/:id/stop', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant) return reply.code(404).send({ error: 'Not found' });
    if (assistant.status !== 'running') {
      throw new AppError('INVALID_STATE', 'Assistant is not running', 400);
    }

    await deploymentQueue.add('stop', {
      type: 'stop',
      assistantId: id,
      containerName: assistant.container_name,
    });

    await app.db('assistants').where({ id }).update({ status: 'stopping', updated_at: new Date() });
    return reply.send({ status: 'stopping' });
  });

  app.post('/:id/restart', async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const { id } = req.params as { id: string };

    const assistant = await app.db('assistants').where({ id, user_id: userId }).first();
    if (!assistant) return reply.code(404).send({ error: 'Not found' });

    await deploymentQueue.add('restart', {
      type: 'restart',
      assistantId: id,
      containerName: assistant.container_name,
      port: assistant.container_port,
    });

    return reply.send({ status: 'restarting' });
  });
}
