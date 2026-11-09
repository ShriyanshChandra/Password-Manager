// Password & Passphrase Generation Utility with Cryptographic Entropy

export interface GeneratorOptions {
  length: number;
  useUpper: boolean;
  useLower: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  avoidAmbiguous: boolean; // avoid 0, O, l, 1, I
  mode: 'password' | 'passphrase' | 'pin';
  wordCount?: number;
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

const AMBIGUOUS = /[0Ol1I]/g;

const CYBER_WORDLIST = [
  'cipher', 'matrix', 'vault', 'crypto', 'shadow', 'neon', 'sunset', 'horizon',
  'quantum', 'nexus', 'vector', 'plasma', 'binary', 'stellar', 'aurora', 'beacon',
  'solaris', 'vortex', 'cobalt', 'ember', 'kinetic', 'prism', 'zenith', 'pulse',
  'titan', 'phoenix', 'monolith', 'mirage', 'spectral', 'tempest', 'seraph', 'glitch'
];

export function generatePassword(options: GeneratorOptions): string {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (self as unknown as { crypto: Crypto }).crypto;

  if (options.mode === 'pin') {
    const bytes = new Uint8Array(options.length || 6);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes).map(b => (b % 10).toString()).join('');
  }

  if (options.mode === 'passphrase') {
    const wordCount = options.wordCount || 4;
    const words: string[] = [];
    const randomBytes = new Uint8Array(wordCount);
    cryptoObj.getRandomValues(randomBytes);
    for (let i = 0; i < wordCount; i++) {
      const idx = randomBytes[i] % CYBER_WORDLIST.length;
      words.push(CYBER_WORDLIST[idx]);
    }
    return words.join('-');
  }

  let charset = '';
  if (options.useLower) charset += LOWERCASE;
  if (options.useUpper) charset += UPPERCASE;
  if (options.useNumbers) charset += NUMBERS;
  if (options.useSymbols) charset += SYMBOLS;

  if (options.avoidAmbiguous) {
    charset = charset.replace(AMBIGUOUS, '');
  }

  if (!charset) charset = LOWERCASE + NUMBERS;

  const bytes = new Uint8Array(options.length);
  cryptoObj.getRandomValues(bytes);

  let result = '';
  for (let i = 0; i < options.length; i++) {
    result += charset[bytes[i] % charset.length];
  }

  return result;
}

export function estimatePasswordEntropy(password: string): {
  entropy: number;
  label: 'WEAK' | 'FAIR' | 'STRONG' | 'SECURE';
  color: string;
} {
  if (!password) return { entropy: 0, label: 'WEAK', color: '#ff3344' };

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  if (poolSize === 0) poolSize = 1;

  const entropy = Math.round(password.length * Math.log2(poolSize));

  if (entropy < 36) {
    return { entropy, label: 'WEAK', color: '#ff3344' };
  } else if (entropy < 60) {
    return { entropy, label: 'FAIR', color: '#ff9900' };
  } else if (entropy < 80) {
    return { entropy, label: 'STRONG', color: '#ffb800' };
  } else {
    return { entropy, label: 'SECURE', color: '#00e5a3' };
  }
}

