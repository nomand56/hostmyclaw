import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('port_pool', (t) => {
    t.integer('port').primary();
    t.text('assistant_id').references('id').inTable('assistants');
    t.timestamp('allocated_at', { useTz: true });
    t.text('server_host').notNullable().defaultTo('localhost');
  });

  await knex.raw(`
    INSERT INTO port_pool (port)
    SELECT generate_series(8100, 9099)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('port_pool');
}
