import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('assistant_secrets', (t) => {
    t.text('id').primary().defaultTo(knex.raw("gen_prefixed_id('sec')"));
    t.text('assistant_id').notNullable().references('id').inTable('assistants').onDelete('CASCADE');
    t.text('skill_id').references('id').inTable('skills');
    t.text('key').notNullable();
    t.binary('value_enc').notNullable();
    t.binary('iv').notNullable();
    t.binary('auth_tag').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['assistant_id', 'key']);
  });

  await knex.raw('CREATE INDEX idx_secrets_assistant_id ON assistant_secrets(assistant_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('assistant_secrets');
}
