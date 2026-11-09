import type { EncryptedVaultBundle, ExtensionSettings, ExtensionVaultItem } from '../types/extension';

const STORAGE_KEY_BUNDLE = 'cipher_vault_encrypted_bundle';
const STORAGE_KEY_SETTINGS = 'cipher_vault_extension_settings';
const STORAGE_KEY_SESSION_TS = 'cipher_vault_last_active_ts';
const STORAGE_KEY_PERSISTENT_ITEMS = 'cipher_vault_persistent_items';
const STORAGE_KEY_CONNECTED_ACCOUNT = 'cipher_vault_connected_account';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoLockMinutes: 0, // 0 = Never lock (Always signed in)
  alwaysSignedIn: true, // Keep extension permanently signed in & connected
  showAutofillIcon: true,
  autoSubmitForm: false,
  lastSyncTimestamp: 0,
};

// Helper to determine if chrome.storage is accessible
function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

export class ExtensionStorageService {
  /**
   * Save the zero-knowledge encrypted vault bundle to chrome.storage.local
   */
  public static async saveBundle(bundle: EncryptedVaultBundle): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY_BUNDLE]: bundle });
    } else {
      localStorage.setItem(STORAGE_KEY_BUNDLE, JSON.stringify(bundle));
    }
  }

  /**
   * Load the encrypted vault bundle
   */
  public static async loadBundle(): Promise<EncryptedVaultBundle | null> {
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEY_BUNDLE);
      return (result[STORAGE_KEY_BUNDLE] as EncryptedVaultBundle) || null;
    } else {
      const data = localStorage.getItem(STORAGE_KEY_BUNDLE);
      return data ? (JSON.parse(data) as EncryptedVaultBundle) : null;
    }
  }

  /**
   * Persistently store decrypted items for the 'Always Signed In' mode
   */
  public static async savePersistentItems(items: ExtensionVaultItem[]): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY_PERSISTENT_ITEMS]: items });
    } else {
      localStorage.setItem(STORAGE_KEY_PERSISTENT_ITEMS, JSON.stringify(items));
    }
  }

  /**
   * Load persistently stored items on browser launch/wake
   */
  public static async loadPersistentItems(): Promise<ExtensionVaultItem[] | null> {
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEY_PERSISTENT_ITEMS);
      const items = result[STORAGE_KEY_PERSISTENT_ITEMS];
      return Array.isArray(items) ? (items as ExtensionVaultItem[]) : null;
    } else {
      const data = localStorage.getItem(STORAGE_KEY_PERSISTENT_ITEMS);
      return data ? (JSON.parse(data) as ExtensionVaultItem[]) : null;
    }
  }

  /**
   * Clear persistent items (e.g. if user explicitly chooses to Disconnect or Reset)
   */
  public static async clearPersistentItems(): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.remove([STORAGE_KEY_PERSISTENT_ITEMS]);
    } else {
      localStorage.removeItem(STORAGE_KEY_PERSISTENT_ITEMS);
    }
  }

  /**
   * Save connected account metadata (email, user ID, sync timestamp)
   */
  public static async saveConnectedAccount(account: { email: string; lastSync: number }): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY_CONNECTED_ACCOUNT]: account });
    } else {
      localStorage.setItem(STORAGE_KEY_CONNECTED_ACCOUNT, JSON.stringify(account));
    }
  }

  /**
   * Load connected account metadata
   */
  public static async loadConnectedAccount(): Promise<{ email: string; lastSync: number } | null> {
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEY_CONNECTED_ACCOUNT);
      return (result[STORAGE_KEY_CONNECTED_ACCOUNT] as { email: string; lastSync: number }) || null;
    } else {
      const data = localStorage.getItem(STORAGE_KEY_CONNECTED_ACCOUNT);
      return data ? (JSON.parse(data) as { email: string; lastSync: number }) : null;
    }
  }

  /**
   * Save user extension settings
   */
  public static async saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    const current = await this.loadSettings();
    const updated: ExtensionSettings = { ...current, ...settings };

    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: updated });
    } else {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    }
    return updated;
  }

  /**
   * Load user extension settings
   */
  public static async loadSettings(): Promise<ExtensionSettings> {
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
      return (result[STORAGE_KEY_SETTINGS] as ExtensionSettings) || DEFAULT_SETTINGS;
    } else {
      const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    }
  }

  /**
   * Record last user activity timestamp for auto-lock evaluation
   */
  public static async recordActivity(): Promise<void> {
    const now = Date.now();
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY_SESSION_TS]: now });
    } else {
      localStorage.setItem(STORAGE_KEY_SESSION_TS, now.toString());
    }
  }

  /**
   * Get last recorded activity timestamp
   */
  public static async getLastActivity(): Promise<number> {
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEY_SESSION_TS);
      return (result[STORAGE_KEY_SESSION_TS] as number) || 0;
    } else {
      const ts = localStorage.getItem(STORAGE_KEY_SESSION_TS);
      return ts ? parseInt(ts, 10) : 0;
    }
  }

  /**
   * Clear all storage (Reset vault and disconnect)
   */
  public static async clearAll(): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.remove([
        STORAGE_KEY_BUNDLE,
        STORAGE_KEY_SESSION_TS,
        STORAGE_KEY_PERSISTENT_ITEMS,
        STORAGE_KEY_CONNECTED_ACCOUNT,
      ]);
    } else {
      localStorage.removeItem(STORAGE_KEY_BUNDLE);
      localStorage.removeItem(STORAGE_KEY_SESSION_TS);
      localStorage.removeItem(STORAGE_KEY_PERSISTENT_ITEMS);
      localStorage.removeItem(STORAGE_KEY_CONNECTED_ACCOUNT);
    }
  }
}

