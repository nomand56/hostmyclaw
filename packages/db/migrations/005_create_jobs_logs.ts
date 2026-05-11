import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('deployment_jobs', (t) => {
    t.text('id').primary().defaultTo(knex.raw("gen_prefixed_id('job')"));
    t.text('assistant_id').notNullable().references('id').inTable('assistants');
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('type').notNullable();
    t.text('status').notNullable().defaultTo('queued');
    t.text('queue_job_id');
    t.integer('attempt').notNullable().defaultTo(0);
    t.integer('max_attempts').notNullable().defaultTo(3);
    t.timestamp('started_at', { useTz: true });
    t.timestamp('finished_at', { useTz: true });
    t.text('error');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('assistant_logs', (t) => {
    t.text('id').primary().defaultTo(knex.raw("gen_prefixed_id('log')"));
    t.text('assistant_id').notNullable().references('id').inTable('assistants').onDelete('CASCADE');
    t.text('job_id').references('id').inTable('deployment_jobs');
    t.text('type').notNullable();
    t.text('level').notNullable();
    t.text('message').notNullable();
    t.jsonb('metadata').defaultTo('{}');
    t.timestamp('timestamp', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_jobs_assistant_id ON deployment_jobs(assistant_id)');
  await knex.raw('CREATE INDEX idx_jobs_status ON deployment_jobs(status)');
  await knex.raw(
    'CREATE INDEX idx_logs_assistant_id_timestamp ON assistant_logs(assistant_id, timestamp DESC)',
  );
  await knex.raw('CREATE INDEX idx_logs_type ON assistant_logs(type)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('assistant_logs');
  await knex.schema.dropTable('deployment_jobs');
}
