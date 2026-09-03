import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { ResolvedAddress } from '@isp-search/domain';
import { z } from 'zod';

/**
 * Encryption for the short-lived raw/resolved address material (ADR-007, PLA-362).
 *
 * AES-256-GCM with a random 96-bit nonce per row; stored as nonce || tag || ciphertext.
 * The key comes from `RAW_ADDRESS_ENCRYPTION_KEY` and carries a version so rotation makes old
 * rows undecryptable-by-design: they are swept by TTL, never migrated.
 */

const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

export interface RawAddressKey {
  readonly version: number;
  /** 64 hex characters (32 bytes). */
  readonly secretHex: string;
}

/** What the worker needs to qualify: the exact resolved address, nothing else. */
export const AddressMaterial = z.object({ resolved: ResolvedAddress }).strict();
export type AddressMaterial = z.infer<typeof AddressMaterial>;

function keyBuffer(key: RawAddressKey): Buffer {
  if (!/^[0-9a-f]{64}$/.test(key.secretHex)) {
    throw new Error('raw address key must be 64 lowercase hex characters');
  }
  return Buffer.from(key.secretHex, 'hex');
}

export function sealAddressMaterial(material: AddressMaterial, key: RawAddressKey): Uint8Array {
  const validated = AddressMaterial.parse(material);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(key), nonce);
  const plaintext = Buffer.from(JSON.stringify(validated), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
}

export class AddressMaterialError extends Error {
  override readonly name = 'AddressMaterialError';
  readonly reason: 'key_version_mismatch' | 'undecryptable' | 'schema_invalid';
  constructor(reason: 'key_version_mismatch' | 'undecryptable' | 'schema_invalid') {
    // The message is a fixed typed code: decryption failures must never echo content.
    super(`address material ${reason}`);
    this.reason = reason;
  }
}

export function openAddressMaterial(
  ciphertext: Uint8Array,
  storedKeyVersion: number,
  key: RawAddressKey,
): AddressMaterial {
  if (storedKeyVersion !== key.version) {
    throw new AddressMaterialError('key_version_mismatch');
  }
  const buffer = Buffer.from(ciphertext);
  if (buffer.length < NONCE_LENGTH + TAG_LENGTH + 1) {
    throw new AddressMaterialError('undecryptable');
  }
  const nonce = buffer.subarray(0, NONCE_LENGTH);
  const tag = buffer.subarray(NONCE_LENGTH, NONCE_LENGTH + TAG_LENGTH);
  const payload = buffer.subarray(NONCE_LENGTH + TAG_LENGTH);
  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyBuffer(key), nonce);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(payload), decipher.final()]);
  } catch {
    throw new AddressMaterialError('undecryptable');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext.toString('utf8'));
  } catch {
    throw new AddressMaterialError('schema_invalid');
  }
  const result = AddressMaterial.safeParse(parsed);
  if (!result.success) {
    throw new AddressMaterialError('schema_invalid');
  }
  return result.data;
}
