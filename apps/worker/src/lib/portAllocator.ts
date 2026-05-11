import { db } from '@hostmyclaw/db';

export async function allocatePort(): Promise<number> {
  return db.transaction(async (trx) => {
    const row = await trx('port_pool')
      .where({ assistant_id: null })
      .forUpdate()
      .skipLocked()
      .first('port');

    if (!row) throw new Error('No ports available');

    await trx('port_pool')
      .where({ port: row.port })
      .update({ assistant_id: 'PENDING', allocated_at: new Date() });

    return row.port;
  });
}

export async function releasePort(port: number): Promise<void> {
  await db('port_pool').where({ port }).update({ assistant_id: null, allocated_at: null });
}
