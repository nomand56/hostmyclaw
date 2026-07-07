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

  // Generate a per-container gateway token so the container doesn't start unauthenticated
  const gatewayToken = Buffer.from(`${job.assistantId}:${internalToken}`).toString('base64').slice(0, 32);

  return {
    ASSISTANT_ID: job.assistantId,
    TENANT_ID: job.userId,
    OPENCLAW_GATEWAY_TOKEN: gatewayToken,
    // Override model/prompt from template at runtime via env
    OPENCLAW_AGENT_MODEL: (job.openclawConfig as TemplateConfig).model ?? 'openai/gpt-5.5',
    OPENCLAW_DISABLE_BONJOUR: '1',
    CONTROL_PLANE_URL: process.env.CONTROL_PLANE_URL ?? '',
    CONTROL_PLANE_TOKEN: internalToken,
    ...decrypted,
  };
}
