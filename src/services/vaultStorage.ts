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

const INITIAL_DEMO_ITEMS: VaultItem[] = [];

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
  public async unlockVault(
    masterPassword: string,
    existingBundle?: EncryptedVaultBundle | null
  ): Promise<{
    masterKey: CryptoKey;
    bundle: EncryptedVaultBundle;
    items: VaultItem[];
  }> {
    const bundle = existingBundle || (await this.getBundle());
    if (!bundle) {
      throw new Error('No vault found. Please create a new vault first.');
    }

    // Verify auth hash (tries 120,000 iterations first, falls back to legacy 20,000 for seamless migration)
    const computedAuthHash = await deriveAuthHash(masterPassword, bundle.salt, 120_000);
    let matched = computedAuthHash === bundle.authHash;
    let needsUpgrade = false;

    if (!matched) {
      const legacyAuthHash = await deriveAuthHash(masterPassword, bundle.salt, 20_000);
      if (legacyAuthHash === bundle.authHash) {
        matched = true;
        needsUpgrade = true;
      }
    }

    if (!matched) {
      throw new Error('ACCESS DENIED: Master password incorrect.');
    }

    // Derive actual key
    const masterKey = await deriveKey(masterPassword, bundle.salt);
    const items = await decryptVault(bundle, masterKey);

    // If upgraded from legacy 20,000 iterations, persist the new hardened authHash
    if (needsUpgrade) {
      bundle.authHash = computedAuthHash;
      await this.saveVault(items, masterKey, bundle);
    }

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
