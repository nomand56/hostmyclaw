import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('assistants', (t) => {
    t.text('id').primary().defaultTo(knex.raw("gen_prefixed_id('asst')"));
    t.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('name').notNullable();
    t.text('template_id').references('id').inTable('templates');
    t.text('status').notNullable().defaultTo('draft');
    t.jsonb('config').notNullable().defaultTo('{}');
    t.text('container_name').unique();
    t.text('container_id');
    t.integer('container_port');
    t.text('subdomain').unique();
    t.text('health_status').defaultTo('unknown');
    t.timestamp('last_health_at', { useTz: true });
    t.timestamp('uptime_since', { useTz: true });
    t.text('error_message');
    t.timestamp('deployed_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('assistant_skills', (t) => {
    t.text('id').primary().defaultTo(knex.raw("gen_prefixed_id('askl')"));
    t.text('assistant_id').notNullable().references('id').inTable('assistants').onDelete('CASCADE');
    t.text('skill_id').notNullable().references('id').inTable('skills');
    t.jsonb('config').notNullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['assistant_id', 'skill_id']);
  });

  await knex.raw('CREATE INDEX idx_assistants_user_id ON assistants(user_id)');
  await knex.raw('CREATE INDEX idx_assistants_status ON assistants(status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('assistant_skills');
  await knex.schema.dropTable('assistants');
}
