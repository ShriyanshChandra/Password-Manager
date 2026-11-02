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

const FIREBASE_CONFIG_KEY = 'cipher_firebase_custom_config';

const DEFAULT_FIREBASE_CONFIG: FirebaseConnectionConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initFromStorageOrEnv();
  }

  public initFromStorageOrEnv(): boolean {
    try {
      const savedConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
      let config: FirebaseConnectionConfig = DEFAULT_FIREBASE_CONFIG;

      if (savedConfig) {
        try {
          config = JSON.parse(savedConfig);
        } catch {
          config = DEFAULT_FIREBASE_CONFIG;
        }
      }

      if (config && config.apiKey && config.projectId) {
        if (!getApps().length) {
          this.app = initializeApp(config);
        } else {
          this.app = getApp();
        }
        this.db = getFirestore(this.app);
        this.auth = getAuth(this.app);
        this.isConfigured = true;
        return true;
      }
    } catch (err) {
      console.warn('Firebase initialization skipped or failed:', err);
    }

    this.isConfigured = false;
    return false;
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
    const config = this.getConfig();
    return {
      isConfigured: this.isConfigured,
      projectId: config?.projectId,
      userEmail: this.auth?.currentUser?.email || null,
    };
  }

  public getCurrentUser(): User | null {
    return this.auth?.currentUser || null;
  }

  public onAuthChange(callback: (user: User | null) => void) {
    if (!this.auth) return () => {};
    return onAuthStateChanged(this.auth, callback);
  }

  // Email / Password Authentication
  public async signInWithEmail(email: string, password: string): Promise<User> {
    if (!this.auth) {
      throw new Error('Firebase Auth is not initialized');
    }
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    return cred.user;
  }

  public async signUpWithEmail(email: string, password: string): Promise<User> {
    if (!this.auth) {
      throw new Error('Firebase Auth is not initialized');
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
    if (!this.isConfigured || !this.db || !this.auth) {
      return false;
    }

    try {
      const user = this.auth.currentUser;
      if (!user) {
        return false;
      }

      const vaultDocRef = doc(this.db, 'vaults', user.uid);

      await setDoc(vaultDocRef, {
        ...bundle,
        lastSyncedAt: Date.now(),
      });

      return true;
    } catch (err) {
      console.error('Firebase cloud sync error:', err);
      return false;
    }
  }

  // Fetch encrypted blob from Firestore
  public async fetchFromCloud(): Promise<EncryptedVaultBundle | null> {
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
    if (!this.db || !this.auth) return;
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      const userDocRef = doc(this.db, 'users', user.uid);
      await setDoc(
        userDocRef,
        {
          email: user.email,
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

  // 2. Save individual credential per account (users/{userId}/credentials/{credentialId})
  public async saveAccountCredential(item: VaultItem, key: CryptoKey): Promise<boolean> {
    if (!this.db || !this.auth) return false;
    const user = this.auth.currentUser;
    if (!user) return false;

    try {
      const { iv, ciphertext } = await encryptSingleItem(item, key);
      const credDocRef = doc(this.db, 'users', user.uid, 'credentials', item.id);
      await setDoc(credDocRef, {
        id: item.id,
        title: item.title,
        category: item.category,
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
