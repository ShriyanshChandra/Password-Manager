import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, type Firestore } from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import type { EncryptedVaultBundle, FirebaseConnectionConfig } from '../types/vault';

const FIREBASE_CONFIG_KEY = 'cipher_firebase_custom_config';

const DEFAULT_FIREBASE_CONFIG: FirebaseConnectionConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCHqpIXjVQh7uHZUxGRHIIzSLQa9V4kqak',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'password-manager-3d385.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'password-manager-3d385',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'password-manager-3d385.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '17985720951',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:17985720951:web:adf4277cf3b203d813ac72',
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
}

export const firebaseService = new FirebaseService();
