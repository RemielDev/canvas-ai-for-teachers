// HACKATHON-MODE encryption for canvas_credentials.token_enc.
// Uses Bun's built-in AES-GCM with a locally-derived key.
//
// PRODUCTION: replace with AWS KMS envelope encryption:
//   1. KMS.GenerateDataKey → (plaintext DEK, encrypted DEK)
//   2. Encrypt token with plaintext DEK locally (AES-GCM)
//   3. Store (encrypted DEK || ciphertext || IV) as bytea
//   4. On decrypt: KMS.Decrypt(encrypted DEK) → DEK → AES-GCM decrypt
//
// The hackathon version below is directionally correct; only the key source
// differs. See docs/DATABASE.md#security-controls for the full policy.

import { env } from "./env";

async function keyFromSecret(): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.JWT_SECRET + "|token-enc")
  );
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plaintext: string): Promise<Uint8Array> {
  const key = await keyFromSecret();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return out;
}

export async function decryptToken(blob: Uint8Array): Promise<string> {
  const key = await keyFromSecret();
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
