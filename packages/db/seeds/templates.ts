import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('templates').del();
  await knex('templates').insert([
    {
      id: 'tmpl_sales_v1',
      name: 'Sales Assistant',
      description: 'Handles lead follow-up, calendar booking, email outreach',
      category: 'sales',
      config_defaults: JSON.stringify({}),
      openclaw_config: JSON.stringify({
        system_prompt: 'You are a professional sales assistant who helps with lead follow-up and scheduling.',
        model: 'gpt-4o',
        temperature: 0.7,
      }),
      required_skill_ids: ['skill_gmail'],
      recommended_skill_ids: ['skill_gmail', 'skill_calendar', 'skill_linkedin'],
      is_active: true,
    },
    {
      id: 'tmpl_support_v1',
      name: 'Customer Support Assistant',
      description: 'Handles customer inquiries and escalations',
      category: 'support',
      config_defaults: JSON.stringify({}),
      openclaw_config: JSON.stringify({
        system_prompt: 'You are a helpful customer support agent who resolves customer issues.',
        model: 'gpt-4o',
        temperature: 0.5,
      }),
      required_skill_ids: [],
      recommended_skill_ids: ['skill_telegram', 'skill_gmail'],
      is_active: true,
    },
  ]);
}
