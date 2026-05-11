import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('skills').del();
  await knex('skills').insert([
    {
      id: 'skill_gmail',
      name: 'Gmail',
      description: 'Read and send emails via Gmail',
      icon_url: null,
      config_schema: JSON.stringify([
        { key: 'oauth_token', label: 'Gmail OAuth Token', type: 'secret', required: true },
        { key: 'email_address', label: 'Email Address', type: 'string', required: true },
      ]),
      openclaw_skill_name: 'gmail',
      is_active: true,
    },
    {
      id: 'skill_calendar',
      name: 'Google Calendar',
      description: 'Schedule and manage calendar events',
      icon_url: null,
      config_schema: JSON.stringify([
        { key: 'oauth_token', label: 'Google OAuth Token', type: 'secret', required: true },
      ]),
      openclaw_skill_name: 'calendar',
      is_active: true,
    },
    {
      id: 'skill_telegram',
      name: 'Telegram Bot',
      description: 'Send and receive Telegram messages',
      icon_url: null,
      config_schema: JSON.stringify([
        { key: 'bot_token', label: 'Telegram Bot Token', type: 'secret', required: true },
      ]),
      openclaw_skill_name: 'telegram',
      is_active: true,
    },
    {
      id: 'skill_linkedin',
      name: 'LinkedIn',
      description: 'Interact with LinkedIn for outreach',
      icon_url: null,
      config_schema: JSON.stringify([
        { key: 'api_key', label: 'LinkedIn API Key', type: 'secret', required: true },
      ]),
      openclaw_skill_name: 'linkedin',
      is_active: true,
    },
  ]);
}
