import type { PasswordGeneratorOptions, PasswordStrength, SecurityAuditResult, VaultItem } from '../types/vault';

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

// Ambiguous characters: 0, O, o, 1, l, I, |
const AMBIGUOUS_CHARS = new Set(['0', 'O', 'o', '1', 'l', 'I', '|', '`', '\'', '"', 'B', '8']);

const PASSPHRASE_WORDS = [
  'cipher', 'matrix', 'quantum', 'vault', 'cyber', 'terminal', 'protocol', 'node',
  'vector', 'binary', 'daemon', 'firewall', 'kernel', 'crypto', 'sector', 'signal',
  'router', 'gateway', 'plasma', 'glitch', 'photon', 'cortex', 'vertex', 'orbit',
  'pulse', 'silicon', 'shadow', 'nebula', 'grid', 'circuit', 'proxy', 'beacon',
  'aurora', 'nexus', 'stealth', 'radar', 'phantom', 'hyper', 'zenith', 'cascade'
];

export function generatePassword(options: PasswordGeneratorOptions): string {
  if (options.mode === 'pin') {
    return generateRandomPin(options.length || 6);
  }

  if (options.mode === 'passphrase') {
    const wordCount = options.wordCount || 4;
    const words: string[] = [];
    const array = new Uint32Array(wordCount);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < wordCount; i++) {
      words.push(PASSPHRASE_WORDS[array[i] % PASSPHRASE_WORDS.length]);
    }
    return words.join('-');
  }

  let charset = '';
  if (options.useLower) charset += LOWERCASE;
  if (options.useUpper) charset += UPPERCASE;
  if (options.useNumbers) charset += NUMBERS;
  if (options.useSymbols) charset += SYMBOLS;

  if (options.avoidAmbiguous) {
    charset = charset.split('').filter((c) => !AMBIGUOUS_CHARS.has(c)).join('');
  }

  if (!charset) {
    charset = LOWERCASE + NUMBERS;
  }

  const length = Math.max(6, Math.min(64, options.length));
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  return result;
}

function generateRandomPin(length: number): string {
  const digits = new Uint32Array(length);
  window.crypto.getRandomValues(digits);
  return Array.from(digits).map((d) => (d % 10).toString()).join('');
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: 'VERY WEAK',
      entropy: 0,
      crackTimeDisplay: 'Instant',
      suggestions: ['Enter a password to evaluate.'],
    };
  }

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  // Calculate Shannon entropy in bits
  const entropy = Math.round(password.length * Math.log2(Math.max(2, poolSize)));

  const suggestions: string[] = [];
  if (password.length < 12) suggestions.push('Increase length to at least 14+ characters');
  if (!/[A-Z]/.test(password)) suggestions.push('Include uppercase characters');
  if (!/[a-z]/.test(password)) suggestions.push('Include lowercase characters');
  if (!/[0-9]/.test(password)) suggestions.push('Include numeric digits');
  if (!/[^a-zA-Z0-9]/.test(password)) suggestions.push('Include special symbols (!@#$)');

  let score = 0;
  let label: PasswordStrength['label'] = 'VERY WEAK';

  if (entropy < 35 || password.length < 8) {
    score = 0;
    label = 'VERY WEAK';
  } else if (entropy < 50 || password.length < 10) {
    score = 1;
    label = 'WEAK';
  } else if (entropy < 65 || password.length < 13) {
    score = 2;
    label = 'MODERATE';
  } else if (entropy < 85 || password.length < 16) {
    score = 3;
    label = 'STRONG';
  } else {
    score = 4;
    label = 'SECURE';
  }

  // Calculate estimated crack time assuming 10 billion hashes/sec
  const seconds = Math.pow(2, entropy) / 10_000_000_000;
  let crackTimeDisplay = 'Instant';

  if (seconds < 1) {
    crackTimeDisplay = '< 1 second';
  } else if (seconds < 60) {
    crackTimeDisplay = `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    crackTimeDisplay = `${Math.round(seconds / 60)} minutes`;
  } else if (seconds < 86400) {
    crackTimeDisplay = `${Math.round(seconds / 3600)} hours`;
  } else if (seconds < 31536000) {
    crackTimeDisplay = `${Math.round(seconds / 86400)} days`;
  } else if (seconds < 31536000 * 100) {
    crackTimeDisplay = `${Math.round(seconds / 31536000)} years`;
  } else if (seconds < 31536000 * 1_000_000) {
    crackTimeDisplay = `${Math.round(seconds / (31536000 * 1000))} thousand years`;
  } else {
    crackTimeDisplay = 'Centuries+';
  }

  return {
    score,
    label,
    entropy,
    crackTimeDisplay,
    suggestions,
  };
}

export function performSecurityAudit(items: VaultItem[]): SecurityAuditResult {
  const loginItems = items.filter((i) => i.password && i.password.trim().length > 0);
  const totalPasswords = loginItems.length;

  if (totalPasswords === 0) {
    return {
      overallScore: 100,
      totalPasswords: 0,
      weakCount: 0,
      reusedCount: 0,
      missing2FACount: 0,
      safeCount: 0,
      reusedGroups: [],
      weakItemIds: [],
    };
  }

  const passwordCounts: { [pwd: string]: string[] } = {};
  const weakItemIds: string[] = [];
  let missing2FACount = 0;

  for (const item of loginItems) {
    const pwd = item.password || '';
    if (!passwordCounts[pwd]) {
      passwordCounts[pwd] = [];
    }
    passwordCounts[pwd].push(item.id);

    const strength = evaluatePasswordStrength(pwd);
    if (strength.score < 2) {
      weakItemIds.push(item.id);
    }

    if (item.category === 'login' && !item.totpSecret) {
      missing2FACount++;
    }
  }

  const reusedGroups: { passwordSnippet: string; count: number; itemIds: string[] }[] = [];
  let reusedCount = 0;

  for (const [pwd, ids] of Object.entries(passwordCounts)) {
    if (ids.length > 1) {
      reusedCount += ids.length;
      reusedGroups.push({
        passwordSnippet: pwd.slice(0, 2) + '••••' + pwd.slice(-1),
        count: ids.length,
        itemIds: ids,
      });
    }
  }

  const weakCount = weakItemIds.length;
  const safeCount = Math.max(0, totalPasswords - weakCount - reusedCount);

  // Score algorithm: starts at 100, drops per weak, reused, or missing 2FA
  const penalty = (weakCount * 18 + reusedCount * 12 + missing2FACount * 3) / Math.max(1, totalPasswords);
  const overallScore = Math.max(10, Math.min(100, Math.round(100 - penalty)));

  return {
    overallScore,
    totalPasswords,
    weakCount,
    reusedCount,
    missing2FACount,
    safeCount,
    reusedGroups,
    weakItemIds,
  };
}

// -------------------------------------------------------------
// TOTP (Time-based One-Time Password RFC 6238)
// -------------------------------------------------------------
function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s-]/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

export async function generateTOTP(secretBase32: string): Promise<{ code: string; secondsRemaining: number }> {
  try {
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = 30;
    const counter = Math.floor(epoch / timeStep);
    const secondsRemaining = timeStep - (epoch % timeStep);

    // Counter buffer (8 bytes big endian)
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    view.setUint32(4, counter, false);

    const secretBytes = base32ToBytes(secretBase32);
    if (secretBytes.length === 0) {
      return { code: '------', secondsRemaining };
    }

    const key = await window.crypto.subtle.importKey(
      'raw',
      secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', key, counterBuffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0x0f;

    const binaryCode =
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff);

    const otp = binaryCode % 1_000_000;
    const code = otp.toString().padStart(6, '0');

    return { code, secondsRemaining };
  } catch (err) {
    console.error('TOTP error:', err);
    return { code: 'ERR', secondsRemaining: 30 };
  }
}

// Generate cryptographically random Base-32 secret key for Authenticator apps
export function generateRandomBase32Secret(byteLength = 20): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const randomBytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(randomBytes);
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < randomBytes.length; i++) {
    value = (value << 8) | randomBytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

// Generate standard otpauth URI recognized by Google Authenticator, Authy, Apple Passwords
export function getTOTPUri(email: string, secretBase32: string): string {
  const issuer = 'code vault:password manager';
  const label = `${issuer}:${email.trim()}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Verify user-submitted 6-digit TOTP code with time-drift tolerance (±1 step / 30s)
export async function verifyTOTP(
  secretBase32: string,
  token: string,
  windowSteps = 1
): Promise<boolean> {
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const currentCounter = Math.floor(epoch / timeStep);
  const secretBytes = base32ToBytes(secretBase32);

  if (secretBytes.length === 0) return false;

  const key = await window.crypto.subtle.importKey(
    'raw',
    secretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // Check current counter, and ±windowSteps to handle slight clock drift
  for (let i = -windowSteps; i <= windowSteps; i++) {
    const counter = currentCounter + i;
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    view.setUint32(4, counter, false);

    const signature = await window.crypto.subtle.sign('HMAC', key, counterBuffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0x0f;

    const binaryCode =
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff);

    const otp = (binaryCode % 1_000_000).toString().padStart(6, '0');
    if (otp === cleanToken) {
      return true;
    }
  }

  return false;
}
