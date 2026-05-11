import { db } from '@hostmyclaw/db';
import { decryptSecret } from '@hostmyclaw/shared';
import type { DeployJobPayload } from '@hostmyclaw/queue';
import jwt from 'jsonwebtoken';

interface TemplateConfig {
  system_prompt?: string;
  model?: string;
  temperature?: number;
  think_level?: string;
}

function buildOpenClawConfig(templateConfig: TemplateConfig, skills: string[]): string {
  const config = {
    agents: {
      primary: {
        model: templateConfig.model ?? 'openai/gpt-4o',
        extraSystemPrompt: templateConfig.system_prompt ?? '',
        temperature: templateConfig.temperature ?? 0.7,
        ...(templateConfig.think_level ? { thinkLevel: templateConfig.think_level } : {}),
      },
    },
    providers: {
      openai: { enabled: true, apiKey: '${OPENAI_API_KEY}' },
    },
    plugins: Object.fromEntries(skills.map((name) => [name, { enabled: true }])),
  };
  return JSON.stringify(config, null, 2);
}

export async function buildEnvVars(job: DeployJobPayload): Promise<Record<string, string>> {
  const secrets = await db('assistant_secrets').where({ assistant_id: job.assistantId });

  const decrypted: Record<string, string> = {};
  for (const secret of secrets) {
    decrypted[secret.key.toUpperCase()] = decryptSecret(
      Buffer.from(secret.value_enc),
      Buffer.from(secret.iv),
      Buffer.from(secret.auth_tag),
    );
  }

  const internalToken = jwt.sign(
    { assistantId: job.assistantId, userId: job.userId, scope: 'callback' },
    process.env.INTERNAL_JWT_SECRET!,
    { expiresIn: '30d' },
  );

  return {
    ASSISTANT_ID: job.assistantId,
    TENANT_ID: job.userId,
    OPENCLAW_PORT: '18789',
    OPENCLAW_CONFIG: buildOpenClawConfig(job.openclawConfig as TemplateConfig, job.skills),
    CONTROL_PLANE_URL: process.env.CONTROL_PLANE_URL ?? '',
    CONTROL_PLANE_TOKEN: internalToken,
    ...decrypted,
  };
}
