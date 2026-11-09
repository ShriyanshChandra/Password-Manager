export type VaultCategory = 'login' | 'card' | 'note' | 'api_key' | 'identity';

export interface ExtensionVaultItem {
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
  salt: string;       // Base64
  authHash: string;   // Base64
  iv: string;         // Base64
  ciphertext: string; // Base64
  hint?: string;
  updatedAt: number;
}

export interface ExtensionSettings {
  autoLockMinutes: number;   // 0 = never auto-lock
  alwaysSignedIn: boolean;   // Keep extension persistently signed in & connected across restarts
  showAutofillIcon: boolean; // Show inline lock icon in inputs
  autoSubmitForm: boolean;   // Auto-submit after autofilling
  lastSyncTimestamp: number;
  accountEmail?: string;     // Connected account email
}

export interface ActiveTabInfo {
  id?: number;
  url: string;
  domain: string;
  title: string;
}

export interface AutoFillPayload {
  username?: string;
  password?: string;
  url?: string;
}

// Background to Popup & Content messages
export type ExtensionMessage =
  | { type: 'GET_VAULT_STATUS' }
  | { type: 'UNLOCK_VAULT'; masterPassword: string }
  | { type: 'LOCK_VAULT' }
  | { type: 'DISCONNECT_ACCOUNT' }
  | { type: 'GET_MATCHING_CREDENTIALS'; url?: string }
  | { type: 'GET_ALL_CREDENTIALS' }
  | { type: 'SAVE_CREDENTIAL'; item: ExtensionVaultItem }
  | { type: 'UPDATE_VAULT_BUNDLE'; bundle: EncryptedVaultBundle }
  | { type: 'SYNC_FROM_WEBAPP'; bundle: EncryptedVaultBundle; items?: ExtensionVaultItem[]; accountEmail?: string }
  | { type: 'OPEN_CONNECT_TAB'; target?: 'local' | 'prod' }
  | { type: 'AUTOFILL_TAB'; tabId?: number; credentials: AutoFillPayload }
  | { type: 'CHECK_PAGE_FIELDS' }
  | { type: 'PAGE_FIELDS_DETECTED'; hasPasswordField: boolean; usernameFound: boolean }
  | { type: 'COPY_TO_CLIPBOARD'; text: string; clearAfterSeconds?: number };

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VaultStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  isAlwaysConnected?: boolean;
  accountEmail?: string;
  lastSyncedAt?: number;
  itemCount: number;
  matchingCount: number;
  hint?: string;
  activeDomain?: string;
}

