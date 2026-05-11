import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const MASTER_KEY = Buffer.from(process.env.SECRET_ENCRYPTION_KEY!, 'hex');

export function encryptSecret(plaintext: string): {
  value_enc: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const value_enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { value_enc, iv, auth_tag: cipher.getAuthTag() };
}

export function decryptSecret(value_enc: Buffer, iv: Buffer, auth_tag: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
  decipher.setAuthTag(auth_tag);
  return decipher.update(value_enc).toString('utf8') + decipher.final('utf8');
}
