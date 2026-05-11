import { randomBytes } from 'crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function base62(bytes: Buffer): string {
  let n = BigInt('0x' + bytes.toString('hex'));
  let result = '';
  while (n > 0n) {
    result = ALPHABET[Number(n % 62n)] + result;
    n = n / 62n;
  }
  return result.padStart(20, '0');
}

export function generateId(prefix: string): string {
  return `${prefix}_${base62(randomBytes(15))}`;
}
