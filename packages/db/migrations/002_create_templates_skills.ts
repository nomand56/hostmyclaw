import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('templates', (t) => {
    t.text('id').primary();
    t.text('name').notNullable();
    t.text('description');
    t.text('category');
    t.jsonb('config_defaults').notNullable().defaultTo('{}');
    t.jsonb('openclaw_config').notNullable().defaultTo('{}');
    t.specificType('required_skill_ids', 'TEXT[]').notNullable().defaultTo('{}');
    t.specificType('recommended_skill_ids', 'TEXT[]').notNullable().defaultTo('{}');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('skills', (t) => {
    t.text('id').primary();
    t.text('name').notNullable();
    t.text('description');
    t.text('icon_url');
    t.jsonb('config_schema').notNullable().defaultTo('[]');
    t.text('openclaw_skill_name').notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('skills');
  await knex.schema.dropTable('templates');
}
