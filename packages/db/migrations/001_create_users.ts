import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION gen_prefixed_id(prefix TEXT) RETURNS TEXT AS $$
    BEGIN
      RETURN prefix || '_' || encode(gen_random_bytes(10), 'hex');
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.schema.createTable('users', (t) => {
    t.text('id').primary().defaultTo(knex.raw("gen_prefixed_id('usr')"));
    t.text('email').unique().notNullable();
    t.text('password_hash').notNullable();
    t.text('name').notNullable();
    t.text('stripe_customer_id').unique();
    t.text('plan').notNullable().defaultTo('free');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('users');
  await knex.raw('DROP FUNCTION IF EXISTS gen_prefixed_id');
}
