import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('subscriptions', (t) => {
    t.text('id').primary().defaultTo(knex.raw("gen_prefixed_id('sub')"));
    t.text('user_id').notNullable().references('id').inTable('users').unique();
    t.text('stripe_subscription_id').unique();
    t.text('stripe_price_id');
    t.text('plan').notNullable().defaultTo('free');
    t.text('status').notNullable().defaultTo('active');
    t.integer('assistant_limit').notNullable().defaultTo(1);
    t.timestamp('current_period_start', { useTz: true });
    t.timestamp('current_period_end', { useTz: true });
    t.boolean('cancel_at_period_end').defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('subscriptions');
}
