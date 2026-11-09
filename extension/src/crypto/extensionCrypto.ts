import type { EncryptedVaultBundle, ExtensionVaultItem } from '../types/extension';

const PBKDF2_ITERATIONS = 120_000;
const AES_KEY_LENGTH = 256;

// Secure Web Crypto API accessor (safe in Window & ServiceWorker)
function getSubtleCrypto(): SubtleCrypto {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (self as unknown as { crypto: Crypto }).crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not supported in this runtime environment.');
  }
  return cryptoObj.subtle;
}

function getRandomValues(array: Uint8Array): Uint8Array {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (self as unknown as { crypto: Crypto }).crypto;
  (cryptoObj as Crypto).getRandomValues(array as unknown as Uint8Array<ArrayBuffer>);
  return array;
}

// Convert ArrayBuffer / Uint8Array to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return (typeof btoa === 'function' ? btoa : (self as unknown as { btoa: (s: string) => string }).btoa)(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const atobFn = typeof atob === 'function' ? atob : (self as unknown as { atob: (s: string) => string }).atob;
  const binary = atobFn(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate cryptographically secure random bytes
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  return getRandomValues(bytes);
}

// Generate base64 salt (16 bytes)
export function generateSalt(length = 16): string {
  return bufferToBase64(generateRandomBytes(length));
}

// Derive AES-GCM 256-bit CryptoKey using PBKDF2-SHA256 (120,000 iterations)
export async function deriveKey(
  masterPassword: string,
  saltBase64: string,
  iterations = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const passwordKey = await subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );

  const salt = base64ToBuffer(saltBase64);

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// Derive authentication hash to verify master password validity without trial decryption
export async function deriveAuthHash(
  masterPassword: string,
  saltBase64: string,
  iterations = PBKDF2_ITERATIONS
): Promise<string> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const passwordKey = await subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const salt = base64ToBuffer(saltBase64);
  const authSalt = new Uint8Array(salt.length + 8);
  authSalt.set(salt);
  authSalt.set(enc.encode('AUTH-TAG'), salt.length);

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: authSalt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return bufferToBase64(derivedBits);
}

// Encrypt vault items array to encrypted bundle with AES-256-GCM
export async function encryptVault(
  items: ExtensionVaultItem[],
  key: CryptoKey,
  saltBase64: string,
  authHash: string,
  hint?: string
): Promise<EncryptedVaultBundle> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const rawData = enc.encode(JSON.stringify(items));
  const iv = generateRandomBytes(12); // Standard 96-bit IV

  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    rawData
  );

  return {
    version: 1,
    salt: saltBase64,
    authHash,
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer),
    hint,
    updatedAt: Date.now(),
  };
}

// Decrypt encrypted bundle back to vault items
export async function decryptVault(
  bundle: EncryptedVaultBundle,
  key: CryptoKey
): Promise<ExtensionVaultItem[]> {
  const subtle = getSubtleCrypto();
  const iv = base64ToBuffer(bundle.iv);
  const ciphertext = base64ToBuffer(bundle.ciphertext);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    ciphertext as BufferSource
  );

  const dec = new TextDecoder();
  const json = dec.decode(decryptedBuffer);
  return JSON.parse(json) as ExtensionVaultItem[];
}
