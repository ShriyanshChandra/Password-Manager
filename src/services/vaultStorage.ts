import type { EncryptedVaultBundle, VaultItem } from '../types/vault';
import {
  deriveAuthHash,
  deriveKey,
  encryptVault,
  decryptVault,
  generateSalt,
} from '../crypto/encryption';
import { firebaseService } from './firebaseService';

const LOCAL_STORAGE_KEY = 'cipher_matrix_vault_bundle';

const INITIAL_DEMO_ITEMS: VaultItem[] = [
  {
    id: 'item-demo-github',
    title: 'GitHub Core Enterprise',
    category: 'login',
    username: 'neo_matrix_agent',
    password: 'k#9X!pQ7$wM2@zL8&vR4',
    url: 'https://github.com/login',
    notes: 'SSH Key deployed to staging cluster. 2FA hardware key backup configured.',
    totpSecret: 'JBSWY3DPEHPK3PXP', // Standard TOTP test secret
    tags: ['dev', 'git', 'infrastructure'],
    favorite: true,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'item-demo-proton',
    title: 'ProtonMail Encrypted Comms',
    category: 'login',
    username: 'agent_zero@pm.me',
    password: 'G7$z*P3!qW9#yK2^mX5~',
    url: 'https://mail.proton.me',
    notes: 'End-to-end PGP email account for critical security alerts.',
    totpSecret: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ',
    tags: ['email', 'privacy', 'pgp'],
    favorite: true,
    createdAt: Date.now() - 86400000 * 12,
    updatedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'item-demo-aws',
    title: 'AWS GovCloud Production',
    category: 'api_key',
    username: 'AKIAIOSFODNN7EXAMPLE',
    password: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    url: 'https://console.aws.amazon.com',
    notes: 'Primary terraform deployer IAM credentials with S3 & Lambda policies.',
    tags: ['cloud', 'aws', 'devops'],
    favorite: false,
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 6,
  },
  {
    id: 'item-demo-card',
    title: 'Quantum Black Metal Card',
    category: 'card',
    cardHolder: 'CIPHER PROTOCOL',
    cardNumber: '4532 •••• •••• 8842',
    cardExpiry: '08/30',
    cardCvv: '792',
    notes: 'Corporate server billing virtual card with $10k limit.',
    tags: ['finance', 'billing'],
    favorite: true,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 10,
  },
  {
    id: 'item-demo-note',
    title: 'Server Root Emergency Recovery Key',
    category: 'note',
    notes: `-----BEGIN MATRIX EMERGENCY RECOVERY SEED-----
whisper horizon dynamic cyber vault matrix quantum vector
protocol 0x994FA2 beacon router circuit firewall pulse 2026
-----END MATRIX EMERGENCY RECOVERY SEED-----

Location: Geographically distributed cold storage vault B-7.`,
    tags: ['recovery', 'security', 'critical'],
    favorite: false,
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now() - 86400000 * 15,
  },
];

export class VaultStorageService {
  // Check if vault has been initialized
  public isVaultInitialized(): boolean {
    return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
  }

  // Get current encrypted bundle from storage or Firebase
  public async getBundle(): Promise<EncryptedVaultBundle | null> {
    // Try cloud first if configured
    try {
      const cloudBundle = await firebaseService.fetchFromCloud();
      if (cloudBundle) {
        // Cache to local
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudBundle));
        return cloudBundle;
      }
    } catch {
      // Fall through to local
    }

    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!localData) return null;
    try {
      return JSON.parse(localData) as EncryptedVaultBundle;
    } catch {
      return null;
    }
  }

  // Initialize a new vault with master password
  public async initializeVault(
    masterPassword: string,
    hint?: string,
    seedDemoData: boolean = true
  ): Promise<{
    masterKey: CryptoKey;
    bundle: EncryptedVaultBundle;
    items: VaultItem[];
  }> {
    const salt = generateSalt(16);
    const masterKey = await deriveKey(masterPassword, salt);
    const authHash = await deriveAuthHash(masterPassword, salt);

    const initialItems = seedDemoData ? INITIAL_DEMO_ITEMS : [];
    const bundle = await encryptVault(initialItems, masterKey, salt, authHash, hint);

    // Save locally
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bundle));

    // Save to Firebase if configured
    await firebaseService.syncToCloud(bundle);

    return { masterKey, bundle, items: initialItems };
  }

  // Unlock existing vault
  public async unlockVault(masterPassword: string): Promise<{
    masterKey: CryptoKey;
    bundle: EncryptedVaultBundle;
    items: VaultItem[];
  }> {
    const bundle = await this.getBundle();
    if (!bundle) {
      throw new Error('No vault found. Please create a new vault first.');
    }

    // Verify auth hash
    const computedAuthHash = await deriveAuthHash(masterPassword, bundle.salt);
    if (computedAuthHash !== bundle.authHash) {
      throw new Error('ACCESS DENIED: Master password incorrect.');
    }

    // Derive actual key
    const masterKey = await deriveKey(masterPassword, bundle.salt);
    const items = await decryptVault(bundle, masterKey);

    return { masterKey, bundle, items };
  }

  // Save vault updates
  public async saveVault(
    items: VaultItem[],
    masterKey: CryptoKey,
    bundle: EncryptedVaultBundle
  ): Promise<EncryptedVaultBundle> {
    const newBundle = await encryptVault(
      items,
      masterKey,
      bundle.salt,
      bundle.authHash,
      bundle.hint
    );

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newBundle));
    await firebaseService.syncToCloud(newBundle);

    return newBundle;
  }

  // Change master password
  public async changeMasterPassword(
    oldPassword: string,
    newPassword: string,
    hint?: string
  ): Promise<{ masterKey: CryptoKey; bundle: EncryptedVaultBundle }> {
    const { items } = await this.unlockVault(oldPassword);

    const newSalt = generateSalt(16);
    const newMasterKey = await deriveKey(newPassword, newSalt);
    const newAuthHash = await deriveAuthHash(newPassword, newSalt);

    const newBundle = await encryptVault(
      items,
      newMasterKey,
      newSalt,
      newAuthHash,
      hint
    );

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newBundle));
    await firebaseService.syncToCloud(newBundle);

    return { masterKey: newMasterKey, bundle: newBundle };
  }

  // Export encrypted backup JSON
  public async exportEncryptedJson(): Promise<string> {
    const bundle = await this.getBundle();
    if (!bundle) throw new Error('No vault to export');
    return JSON.stringify(
      {
        cipherVaultExport: true,
        exportDate: new Date().toISOString(),
        payload: bundle,
      },
      null,
      2
    );
  }

  // Import encrypted backup JSON
  public async importEncryptedJson(jsonContent: string): Promise<boolean> {
    const data = JSON.parse(jsonContent);
    const bundle: EncryptedVaultBundle = data.payload || data;
    if (!bundle.salt || !bundle.ciphertext || !bundle.authHash) {
      throw new Error('Invalid vault backup format');
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bundle));
    await firebaseService.syncToCloud(bundle);
    return true;
  }

  // Factory reset / wipe
  public resetVault() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

export const vaultStorage = new VaultStorageService();
