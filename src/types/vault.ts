export type VaultCategory = 'login' | 'card' | 'note' | 'api_key' | 'identity';

export interface VaultItem {
  id: string;
  title: string;
  category: VaultCategory;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  totpSecret?: string;
  tags?: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  // Specific fields for cards / identity
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardHolder?: string;
}

export interface EncryptedVaultBundle {
  version: number;
  salt: string; // Base64
  authHash: string; // Base64 (for master password verification)
  iv: string; // Base64
  ciphertext: string; // Base64
  hint?: string;
  updatedAt: number;
}

export interface PasswordGeneratorOptions {
  length: number;
  useUpper: boolean;
  useLower: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  avoidAmbiguous: boolean; // avoid 0, O, l, 1, etc.
  mode: 'password' | 'passphrase' | 'pin';
  wordCount?: number;
}

export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'VERY WEAK' | 'WEAK' | 'MODERATE' | 'STRONG' | 'SECURE';
  entropy: number; // in bits
  crackTimeDisplay: string;
  suggestions: string[];
}

export interface SecurityAuditResult {
  overallScore: number;
  totalPasswords: number;
  weakCount: number;
  reusedCount: number;
  missing2FACount: number;
  safeCount: number;
  reusedGroups: { passwordSnippet: string; count: number; itemIds: string[] }[];
  weakItemIds: string[];
}

export interface FirebaseConnectionConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}
