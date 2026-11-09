import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import type { EncryptedVaultBundle, FirebaseConnectionConfig, VaultItem } from '../types/vault';
import { encryptSingleItem, decryptSingleItem } from '../crypto/encryption';

export interface UserProfileDoc {
  uid: string;
  email: string;
  lastLoginAt: number;
  authHash?: string;
  salt?: string;
  totpEnabled?: boolean;
  totpSecret?: string;
  totpConfiguredAt?: number;
}

const FIREBASE_CONFIG_KEY = 'cipher_firebase_custom_config';

const DEFAULT_FIREBASE_CONFIG: FirebaseConnectionConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim() || 'AIzaSyCHqpIXjVQh7uHZUxGRHIIzSLQa9V4kqak',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim() || 'password-manager-3d385.firebaseapp.com',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim() || 'password-manager-3d385',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim() || 'password-manager-3d385.firebasestorage.app',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim() || '17985720951',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim() || '1:17985720951:web:adf4277cf3b203d813ac72',
};

export class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initFromStorageOrEnv();
  }

  private applyConfig(config: FirebaseConnectionConfig): boolean {
    try {
      if (!config || !config.apiKey || !config.projectId) {
        return false;
      }

      let app: FirebaseApp;
      if (!getApps().length) {
        app = initializeApp(config);
      } else {
        try {
          app = getApp();
        } catch {
          app = initializeApp(config);
        }
      }

      this.app = app;
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      this.isConfigured = true;
      return true;
    } catch (err) {
      console.warn('Firebase initialization attempt failed:', err);
      return false;
    }
  }

  public initFromStorageOrEnv(): boolean {
    // 1. Check custom user configuration in localStorage
    try {
      const savedConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          if (
            parsed &&
            typeof parsed.apiKey === 'string' &&
            parsed.apiKey.trim().length > 10 &&
            typeof parsed.projectId === 'string' &&
            parsed.projectId.trim().length > 0
          ) {
            if (this.applyConfig(parsed)) {
              return true;
            }
          }
          // If stored custom config was invalid or failed initialization, purge it
          localStorage.removeItem(FIREBASE_CONFIG_KEY);
        } catch {
          localStorage.removeItem(FIREBASE_CONFIG_KEY);
        }
      }
    } catch {
      // localStorage may be unavailable or restricted in some iframe contexts
    }

    // 2. Fall back reliably to DEFAULT_FIREBASE_CONFIG
    const defaultSuccess = this.applyConfig(DEFAULT_FIREBASE_CONFIG);
    if (!defaultSuccess) {
      this.isConfigured = false;
    }
    return defaultSuccess;
  }

  public ensureInitialized(): boolean {
    if (this.auth && this.db && this.isConfigured) {
      return true;
    }
    const success = this.initFromStorageOrEnv();
    if (!success || !this.auth) {
      return this.applyConfig(DEFAULT_FIREBASE_CONFIG);
    }
    return success;
  }

  public saveConfig(config: FirebaseConnectionConfig) {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    this.initFromStorageOrEnv();
  }

  public getConfig(): FirebaseConnectionConfig {
    const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall back
      }
    }
    return DEFAULT_FIREBASE_CONFIG;
  }

  public clearConfig() {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    this.initFromStorageOrEnv();
  }

  public getStatus(): { isConfigured: boolean; projectId?: string; userEmail?: string | null } {
    this.ensureInitialized();
    const config = this.getConfig();
    return {
      isConfigured: this.isConfigured,
      projectId: config?.projectId,
      userEmail: this.auth?.currentUser?.email || null,
    };
  }

  public getCurrentUser(): User | null {
    this.ensureInitialized();
    return this.auth?.currentUser || null;
  }

  public onAuthChange(callback: (user: User | null) => void) {
    this.ensureInitialized();
    if (!this.auth) return () => {};
    return onAuthStateChanged(this.auth, callback);
  }

  // Email / Password Authentication
  public async signInWithEmail(email: string, password: string): Promise<User> {
    this.ensureInitialized();
    if (!this.auth) {
      throw new Error('Firebase Auth is not initialized. Please check your network connection.');
    }
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    return cred.user;
  }

  public async signUpWithEmail(email: string, password: string): Promise<User> {
    this.ensureInitialized();
    if (!this.auth) {
      throw new Error('Firebase Auth is not initialized. Please check your network connection.');
    }
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    return cred.user;
  }

  public async signOutUser(): Promise<void> {
    if (this.auth) {
      await signOut(this.auth);
    }
  }

  // Upload encrypted blob to Firestore (Only ciphertext is ever sent, zero-knowledge!)
  public async syncToCloud(bundle: EncryptedVaultBundle): Promise<boolean> {
    this.ensureInitialized();
    if (!this.isConfigured || !this.db || !this.auth) {
      return false;
    }

    try {
      const user = this.auth.currentUser;
      if (!user) {
        return false;
      }

      const vaultDocRef = doc(this.db, 'vaults', user.uid);

      const payload: Record<string, unknown> = {
        version: bundle.version,
        salt: bundle.salt,
        authHash: bundle.authHash,
        iv: bundle.iv,
        ciphertext: bundle.ciphertext,
        updatedAt: bundle.updatedAt || Date.now(),
        lastSyncedAt: Date.now(),
      };
      if (bundle.hint && typeof bundle.hint === 'string' && bundle.hint.trim().length > 0) {
        payload.hint = bundle.hint.trim();
      }

      await setDoc(vaultDocRef, payload);

      return true;
    } catch (err) {
      console.error('Firebase cloud sync error:', err);
      return false;
    }
  }

  // Fetch encrypted blob from Firestore
  public async fetchFromCloud(): Promise<EncryptedVaultBundle | null> {
    this.ensureInitialized();
    if (!this.isConfigured || !this.db || !this.auth) {
      return null;
    }

    try {
      const user = this.auth.currentUser;
      if (!user) {
        return null;
      }

      const vaultDocRef = doc(this.db, 'vaults', user.uid);
      const snap = await getDoc(vaultDocRef);

      if (snap.exists()) {
        return snap.data() as EncryptedVaultBundle;
      }
      return null;
    } catch (err) {
      console.error('Firebase fetch error:', err);
      return null;
    }
  }

  // ── Per-Account Firestore Space ──────────────────────────────────────────────

  // 1. Record user login in Firestore under `users/{userId}`
  public async recordUserLogin(authHash?: string, salt?: string): Promise<void> {
    this.ensureInitialized();
    if (!this.db || !this.auth) return;
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      const userDocRef = doc(this.db, 'users', user.uid);
      await setDoc(
        userDocRef,
        {
          email: user.email || '',
          uid: user.uid,
          lastLoginAt: Date.now(),
          ...(authHash ? { authHash } : {}),
          ...(salt ? { salt } : {}),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not record user login metadata in Firestore:', err);
    }
  }

  // 2. Fetch user profile from `users/{userId}`
  public async getUserProfile(userId?: string): Promise<UserProfileDoc | null> {
    this.ensureInitialized();
    if (!this.db) return null;
    const uid = userId || this.auth?.currentUser?.uid;
    if (!uid) return null;

    try {
      const userDocRef = doc(this.db, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        return snap.data() as UserProfileDoc;
      }
      return null;
    } catch (err) {
      console.warn('Could not fetch user profile from Firestore:', err);
      return null;
    }
  }

  // 3. Save User 2FA TOTP configuration to `users/{userId}`
  public async saveUser2FA(secret: string): Promise<boolean> {
    this.ensureInitialized();
    if (!this.db || !this.auth) return false;
    const user = this.auth.currentUser;
    if (!user) return false;

    try {
      const userDocRef = doc(this.db, 'users', user.uid);
      await setDoc(
        userDocRef,
        {
          email: user.email || '',
          uid: user.uid,
          lastLoginAt: Date.now(),
          totpEnabled: true,
          totpSecret: secret,
          totpConfiguredAt: Date.now(),
        },
        { merge: true }
      );
      return true;
    } catch (err) {
      console.error('Error saving user 2FA configuration:', err);
      return false;
    }
  }

  // 2. Save individual credential per account (users/{userId}/credentials/{credentialId})
  public async saveAccountCredential(item: VaultItem, key: CryptoKey): Promise<boolean> {
    this.ensureInitialized();
    if (!this.db || !this.auth) return false;
    const user = this.auth.currentUser;
    if (!user) return false;

    try {
      const { iv, ciphertext } = await encryptSingleItem(item, key);
      const credDocRef = doc(this.db, 'users', user.uid, 'credentials', item.id);
      await setDoc(credDocRef, {
        id: item.id,
        iv,
        ciphertext,
        updatedAt: Date.now(),
      });
      return true;
    } catch (err) {
      console.error('Error saving account credential to Firestore:', err);
      return false;
    }
  }

  // 3. Delete individual credential per account (users/{userId}/credentials/{credentialId})
  public async deleteAccountCredential(itemId: string): Promise<boolean> {
    this.ensureInitialized();
    if (!this.db || !this.auth) return false;
    const user = this.auth.currentUser;
    if (!user) return false;

    try {
      const credDocRef = doc(this.db, 'users', user.uid, 'credentials', itemId);
      await deleteDoc(credDocRef);
      return true;
    } catch (err) {
      console.error('Error deleting account credential from Firestore:', err);
      return false;
    }
  }

  // 4. Fetch all individual credentials for current account (users/{userId}/credentials)
  public async fetchAccountCredentials(key: CryptoKey): Promise<VaultItem[]> {
    this.ensureInitialized();
    if (!this.db || !this.auth) return [];
    const user = this.auth.currentUser;
    if (!user) return [];

    try {
      const credsColRef = collection(this.db, 'users', user.uid, 'credentials');
      const snap = await getDocs(credsColRef);
      const items: VaultItem[] = [];

      for (const d of snap.docs) {
        const data = d.data();
        if (data.iv && data.ciphertext) {
          try {
            const decrypted = await decryptSingleItem(data.iv, data.ciphertext, key);
            items.push(decrypted);
          } catch (decErr) {
            console.warn(`Failed to decrypt credential ${d.id}:`, decErr);
          }
        }
      }
      return items;
    } catch (err) {
      console.error('Error fetching account credentials from Firestore:', err);
      return [];
    }
  }
}

export const firebaseService = new FirebaseService();
